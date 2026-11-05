"""把原始谱例图片压缩成人可直接内置的示例资源。

用法：python scripts/build-sample-images.py [源目录]
默认读取桌面《谱》目录下的 Like-a-star谱例-1..7.jpg，
输出到 public/sample/like-a-star/page-01..07.jpg 与 thumb-01..07.jpg。
"""
import os
import sys

from PIL import Image

DEFAULT_SRC = os.path.expanduser("~/Desktop/谱")
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "sample", "like-a-star")
PAGES = 7


def main() -> int:
    src = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SRC
    os.makedirs(OUT_DIR, exist_ok=True)
    total = 0
    for index in range(1, PAGES + 1):
        source = os.path.join(src, f"Like-a-star谱例-{index}.jpg")
        if not os.path.exists(source):
            print(f"缺少文件：{source}")
            return 1
        image = Image.open(source).convert("RGB")
        stem = f"{index:02d}"
        page_path = os.path.join(OUT_DIR, f"page-{stem}.jpg")
        image.save(page_path, quality=86, optimize=True, progressive=True)

        thumb = image.copy()
        thumb.thumbnail((320, 320 * image.height // image.width))
        thumb_path = os.path.join(OUT_DIR, f"thumb-{stem}.jpg")
        thumb.save(thumb_path, quality=78, optimize=True)

        total += os.path.getsize(page_path) + os.path.getsize(thumb_path)
        print(f"page-{stem}.jpg {os.path.getsize(page_path) // 1024} KB，thumb-{stem}.jpg {os.path.getsize(thumb_path) // 1024} KB")
    print(f"合计 {total // 1024} KB -> {OUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
