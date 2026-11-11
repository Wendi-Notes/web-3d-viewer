# 使用しているオープンソース

| ライブラリ | 用途 | ライセンス |
|---|---|---|
| [three.js](https://github.com/mrdoob/three.js) | 3D 表示・STL / 3MF 読み込み | MIT |
| [@mlightcad/cad-simple-viewer](https://github.com/mlightcad/cad-viewer) | DXF / DWG 表示・2D 計測 | MIT |
| [@mlightcad/data-model](https://github.com/mlightcad/realdwg-web) ほか mlightcad 関連パッケージ | 図面データ・DXF 読み込み | MIT |
| [@mlightcad/libredwg-converter](https://github.com/mlightcad/realdwg-web) / [libredwg-web](https://github.com/mlightcad/libredwg-web) | DWG 読み込み | **GPL-3.0** |
| [LibreDWG](https://www.gnu.org/software/libredwg/) | DWG 読み込み（libredwg-web の中身） | **GPL-3.0** |
| [lodash-es](https://github.com/lodash/lodash) | ユーティリティ | MIT |
| [Vite](https://github.com/vitejs/vite) | 組み立て（開発時のみ） | MIT |

## フォントについて

DXF / DWG の文字表示用フォントは [mlightcad/cad-data](https://github.com/mlightcad/cad-data) のものを、実行時（または `npm run fonts` 実行時）に取得します。
再配布できないフォントが含まれるため、このリポジトリには同梱していません。
