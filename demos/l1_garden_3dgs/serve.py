"""Portable, standard-library-only launcher for the Garden demo bundle."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import webbrowser


class DemoHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript',
        '.spz': 'application/octet-stream',
    }

    def log_message(self, *args):
        pass


def main():
    parser = argparse.ArgumentParser(description='Open the Garden 3D demo locally.')
    parser.add_argument('--no-browser', action='store_true')
    parser.add_argument('--url-file', type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    with ThreadingHTTPServer(
        ('127.0.0.1', 0), partial(DemoHandler, directory=str(root))
    ) as server:
        url = f'http://127.0.0.1:{server.server_port}/viewer/'
        print('Garden 3D Demo', flush=True)
        print('浏览期间请保留此窗口，关闭窗口即可结束演示。', flush=True)
        print('如果浏览器没有自动打开，请复制这个地址：', flush=True)
        print(url, flush=True)
        if args.url_file:
            args.url_file.write_text(url, encoding='utf-8')
        if not args.no_browser:
            webbrowser.open(url)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
