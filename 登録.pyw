# -*- coding: utf-8 -*-
"""
Web 3D Viewer をエクスプローラーに登録します（管理者権限は不要・このユーザーだけ）。

- 「プログラムから開く」に Web 3D Viewer を追加（STL / 3MF / DXF / DWG / SVG）
- 右クリックメニューに「Web 3D Viewerで開く」を追加
- web3d:// リンク（AnythingLLM など）の起動先を Python 版に切り替え

ダブルクリックで実行してください。取り消しは「登録解除.pyw」。
"""
import os
import sys
import winreg

TITLE = "Web 3D Viewer 登録"
BASE = os.path.dirname(os.path.abspath(__file__))
LAUNCHER = os.path.join(BASE, "launcher.pyw")
ICON = os.path.join(BASE, "app", "web3d.ico")
PROGID = "Web3DViewer.File"
EXTS = [".stl", ".3mf", ".dxf", ".dwg", ".svg"]
VERB = "Web3DViewer"
VERB_LABEL = "Web 3D Viewerで開く"


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


def msg(t, err=False):
    _notify(t, TITLE)


def pythonw():
    exe = sys.executable
    d = os.path.dirname(exe)
    cand = os.path.join(d, "pythonw.exe")
    return cand if os.path.isfile(cand) else exe


def setv(path, name, value):
    with winreg.CreateKeyEx(winreg.HKEY_CURRENT_USER, r"Software\Classes" + "\\" + path, 0, winreg.KEY_WRITE) as k:
        winreg.SetValueEx(k, name, 0, winreg.REG_SZ, value)


def main():
    if not os.path.isfile(LAUNCHER):
        return msg("launcher.pyw が見つかりません:\n" + LAUNCHER, True)
    pyw = pythonw()
    cmd = '"{}" "{}" "%1"'.format(pyw, LAUNCHER)
    icon = '"{}"'.format(ICON) if os.path.isfile(ICON) else '"{}",0'.format(pyw)

    # ProgID（「プログラムから開く」で表示される名前とコマンド）
    setv(PROGID, "", "Web 3D Viewer")
    setv(PROGID, "FriendlyTypeName", "Web 3D Viewer")
    setv(PROGID + r"\DefaultIcon", "", icon)
    setv(PROGID + r"\shell\open", "FriendlyAppName", "Web 3D Viewer")
    setv(PROGID + r"\shell\open\command", "", cmd)

    for ext in EXTS:
        setv(ext + r"\OpenWithProgids", PROGID, "")
        # 右クリックメニュー
        setv(r"SystemFileAssociations" + "\\" + ext + r"\shell" + "\\" + VERB, "", VERB_LABEL)
        setv(r"SystemFileAssociations" + "\\" + ext + r"\shell" + "\\" + VERB, "Icon", icon)
        setv(r"SystemFileAssociations" + "\\" + ext + r"\shell" + "\\" + VERB + r"\command", "", cmd)

    # web3d:// リンク
    setv("web3d", "", "URL:Web 3D Viewer")
    setv("web3d", "URL Protocol", "")
    setv(r"web3d\DefaultIcon", "", icon)
    setv(r"web3d\shell\open\command", "", cmd)


    msg("登録しました。\n\n"
        "・右クリック →「Web 3D Viewerで開く」で開けます\n"
        "・ダブルクリックで開きたい場合は、ファイルを右クリック →「プログラムから開く」→\n"
        "　「別のプログラムを選択」→「Web 3D Viewer」を選び「常に使う」を押してください\n"
        "　（Windowsの決まりで、この操作だけは手動です）\n\n"
        "使用する Python:\n" + pyw)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        msg("登録に失敗しました:\n%s" % e, True)
