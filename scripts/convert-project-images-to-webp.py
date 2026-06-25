from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
WORKS_JSON = PUBLIC / "content" / "works.json"
HOME_JSON = PUBLIC / "content" / "home.json"
REPORT_JSON = ROOT / "qa-screenshots" / "webp-conversion-report.json"
CONTACT_SHEET = ROOT / "qa-screenshots" / "webp-quality-contact-sheet.jpg"

RASTER_EXTS = {".jpg", ".jpeg", ".png"}


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


def is_project_raster(path: str) -> bool:
    file_path = public_path_to_file(path)
    return (
        path.startswith("/projects/")
        and file_path.suffix.lower() in RASTER_EXTS
        and file_path.exists()
    )


def is_hero_path(path: str, hero_paths: set[str]) -> bool:
    name = public_path_to_file(path).stem.lower()
    return path in hero_paths or name == "hero"


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


def thumbnail_for(path: Path, size=(360, 240)) -> Image.Image:
    with Image.open(path) as image:
        image = image.convert("RGBA")
        image.thumbnail(size, Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", size, (245, 245, 242, 255))
        left = (size[0] - image.width) // 2
        top = (size[1] - image.height) // 2
        canvas.alpha_composite(image, (left, top))
        return canvas.convert("RGB")


def make_contact_sheet(records):
    samples = sorted(records, key=lambda item: item["original_size"], reverse=True)[:8]
    hero_samples = [item for item in records if item["quality"] >= 90][:6]
    unique = []
    seen = set()
    for item in hero_samples + samples:
        if item["source"] not in seen:
            seen.add(item["source"])
            unique.append(item)
    unique = unique[:10]
    if not unique:
        return

    cell_w, cell_h = 760, 300
    sheet = Image.new("RGB", (cell_w, cell_h * len(unique)), "white")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    for row, record in enumerate(unique):
        y = row * cell_h
        original_path = ROOT / record["source"]
        webp_path = ROOT / record["webp"]
        sheet.paste(thumbnail_for(original_path), (0, y + 34))
        sheet.paste(thumbnail_for(webp_path), (380, y + 34))
        title = (
            f"{record['public_source']} | q{record['quality']} | "
            f"{record['original_size'] // 1024}KB -> {record['webp_size'] // 1024}KB | "
            f"PSNR {record['psnr']:.1f}dB"
        )
        draw.text((8, y + 8), title, fill=(20, 20, 20), font=font)
        draw.text((8, y + 278), "original", fill=(70, 70, 70), font=font)
        draw.text((388, y + 278), "webp", fill=(70, 70, 70), font=font)

    CONTACT_SHEET.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(CONTACT_SHEET, quality=92)


def main():
    works = json.loads(WORKS_JSON.read_text(encoding="utf-8"))
    home = json.loads(HOME_JSON.read_text(encoding="utf-8"))

    works_paths = {path for path in walk_strings(works) if is_project_raster(path)}
    home_paths = {path for path in walk_strings(home) if is_project_raster(path)}
    hero_paths = set()
    for work in works:
        for key in ("coverImage", "heroImage"):
            path = work.get(key)
            if isinstance(path, str):
                hero_paths.add(path)
    hero_paths.update(home_paths)

    candidates = sorted(works_paths | home_paths)
    converted = []
    skipped = []
    replacements = {}

    for public_path in candidates:
        src = public_path_to_file(public_path)
        dst = src.with_suffix(".webp")
        quality = 92 if is_hero_path(public_path, hero_paths) else 86

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

    WORKS_JSON.write_text(
        json.dumps(replace_strings(works, replacements), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    HOME_JSON.write_text(
        json.dumps(replace_strings(home, replacements), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

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
                "json_files_updated": [
                    str(WORKS_JSON.relative_to(ROOT)),
                    str(HOME_JSON.relative_to(ROOT)),
                ],
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    make_contact_sheet(converted)
    print(f"Converted {len(converted)} images; skipped {len(skipped)}.")
    print(f"Report: {REPORT_JSON}")
    print(f"Contact sheet: {CONTACT_SHEET}")


if __name__ == "__main__":
    main()
