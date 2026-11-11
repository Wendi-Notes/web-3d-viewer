# -*- coding: utf-8 -*-
"""「登録.pyw」で追加した設定を取り消します。"""
import os
import winreg

TITLE = "Web 3D Viewer 登録解除"
PROGID = "Web3DViewer.File"
EXTS = [".stl", ".3mf", ".dxf", ".dwg", ".svg"]
VERB = "Web3DViewer"
ROOT = r"Software\Classes"


def _notify(text, title):
    """ctypes を使わずにメッセージを出す（メモ帳で表示）。
    ※ 10月の更新以降、スマートアプリコントロールが _ctypes.pyd を止めることがあるため"""
    import tempfile
    p = os.path.join(tempfile.gettempdir(), "web3d_message.txt")
    with open(p, "w", encoding="utf-8-sig") as fh:
        fh.write("【" + title + "】\r\n\r\n" + text.replace("\n", "\r\n"))
    try:
        os.startfile(p)
    except Exception:
        print(text)


def delete_tree(path):
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, path, 0, winreg.KEY_ALL_ACCESS) as k:
            while True:
                try:
                    sub = winreg.EnumKey(k, 0)
                except OSError:
                    break
                delete_tree(path + "\\" + sub)
        winreg.DeleteKey(winreg.HKEY_CURRENT_USER, path)
    except FileNotFoundError:
        pass


def delete_value(path, name):
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, path, 0, winreg.KEY_SET_VALUE) as k:
            winreg.DeleteValue(k, name)
    except FileNotFoundError:
        pass


def main():
    delete_tree(ROOT + "\\" + PROGID)
    delete_tree(ROOT + r"\web3d")
    for ext in EXTS:
        delete_value(ROOT + "\\" + ext + r"\OpenWithProgids", PROGID)
        delete_tree(ROOT + r"\SystemFileAssociations" + "\\" + ext + r"\shell" + "\\" + VERB)
    _notify("登録を解除しました。", TITLE)


if __name__ == "__main__":
    main()
