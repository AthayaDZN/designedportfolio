from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
CONTENT = PUBLIC / "content"
REPORT_JSON = ROOT / "qa-screenshots" / "upload-webp-conversion-report.json"
RASTER_EXTS = {".jpg", ".jpeg", ".png"}
MIN_SIZE_BYTES = 500 * 1024


def walk_strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for item in value:
            yield from walk_strings(item)
    elif isinstance(value, dict):
        for item in value.values():
            yield from walk_strings(item)


def replace_strings(value, replacements):
    if isinstance(value, str):
        return replacements.get(value, value)
    if isinstance(value, list):
        return [replace_strings(item, replacements) for item in value]
    if isinstance(value, dict):
        return {key: replace_strings(item, replacements) for key, item in value.items()}
    return value


def public_path_to_file(path: str) -> Path:
    return PUBLIC / path.lstrip("/")


def to_public_path(path: Path) -> str:
    return "/" + path.relative_to(PUBLIC).as_posix()


def is_candidate(path: str) -> bool:
    file_path = public_path_to_file(path)
    return (
        (path.startswith("/uploads/images/") or path.startswith("/uploads/backgrounds/"))
        and file_path.suffix.lower() in RASTER_EXTS
        and file_path.exists()
        and file_path.stat().st_size >= MIN_SIZE_BYTES
    )


def quality_for(path: str) -> int:
    return 90 if path.startswith("/uploads/backgrounds/") else 88


def psnr(original: Image.Image, converted: Image.Image) -> float:
    original = original.convert("RGBA")
    converted = converted.convert("RGBA")
    diff = ImageChops.difference(original, converted)
    histogram = diff.histogram()
    sq = (value * ((index % 256) ** 2) for index, value in enumerate(histogram))
    mse = sum(sq) / float(original.size[0] * original.size[1] * 4)
    if mse == 0:
        return float("inf")
    return 20 * math.log10(255.0 / math.sqrt(mse))


def main():
    json_files = sorted(path for path in CONTENT.glob("*.json") if path.is_file())
    payloads = {path: json.loads(path.read_text(encoding="utf-8")) for path in json_files}
    candidates = sorted({path for payload in payloads.values() for path in walk_strings(payload) if is_candidate(path)})

    converted = []
    skipped = []
    replacements = {}

    for public_path in candidates:
        src = public_path_to_file(public_path)
        dst = src.with_suffix(".webp")
        quality = quality_for(public_path)

        with Image.open(src) as image:
            image.save(
                dst,
                "WEBP",
                quality=quality,
                method=6,
                exact=image.mode in {"RGBA", "LA", "P"},
            )

        original_size = src.stat().st_size
        webp_size = dst.stat().st_size
        with Image.open(src) as original, Image.open(dst) as webp:
            metric = psnr(original, webp)

        record = {
            "public_source": public_path,
            "public_webp": to_public_path(dst),
            "source": str(src.relative_to(ROOT)),
            "webp": str(dst.relative_to(ROOT)),
            "quality": quality,
            "original_size": original_size,
            "webp_size": webp_size,
            "savings_bytes": original_size - webp_size,
            "savings_percent": round((1 - webp_size / original_size) * 100, 2),
            "psnr": metric if math.isfinite(metric) else 99.0,
        }

        if webp_size < original_size and metric >= 32:
            converted.append(record)
            replacements[public_path] = to_public_path(dst)
        else:
            dst.unlink(missing_ok=True)
            skipped.append(record)

    missing = [
        {"from": old, "to": new}
        for old, new in replacements.items()
        if not public_path_to_file(new).exists()
    ]
    if missing:
        raise SystemExit(f"Converted files missing, refusing JSON update: {missing}")

    for path, payload in payloads.items():
        next_payload = replace_strings(payload, replacements)
        if next_payload != payload:
            path.write_text(json.dumps(next_payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    REPORT_JSON.parent.mkdir(parents=True, exist_ok=True)
    REPORT_JSON.write_text(
        json.dumps(
            {
                "converted_count": len(converted),
                "skipped_count": len(skipped),
                "total_original_bytes": sum(item["original_size"] for item in converted),
                "total_webp_bytes": sum(item["webp_size"] for item in converted),
                "converted": converted,
                "skipped": skipped,
                "json_files_checked": [str(path.relative_to(ROOT)) for path in json_files],
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Converted {len(converted)} upload images; skipped {len(skipped)}.")
    print(f"Report: {REPORT_JSON}")


if __name__ == "__main__":
    main()
