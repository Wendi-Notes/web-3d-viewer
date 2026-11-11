# 使用しているオープンソース

| ライブラリ | 用途 | ライセンス |
|---|---|---|
| [three.js](https://github.com/mrdoob/three.js) | 3D 表示・STL / 3MF 読み込み | MIT |
| [@mlightcad/cad-simple-viewer](https://github.com/mlightcad/cad-viewer) | DXF / DWG 表示・2D 計測 | MIT |
| [@mlightcad/data-model](https://github.com/mlightcad/realdwg-web) ほか mlightcad 関連パッケージ（common / geometry-engine / graphic-interface / three-renderer / mtext-parser / mtext-renderer / shx-parser） | 図面データ・DXF 読み込み・文字描画 | MIT |
| [@mlightcad/emf-converter](https://github.com/mlightcad/realdwg-web) | 図面内の EMF 画像の変換 | Apache-2.0 |
| [@mlightcad/libredwg-converter](https://github.com/mlightcad/realdwg-web) / [libredwg-web](https://github.com/mlightcad/libredwg-web) | DWG 読み込み | **GPL-3.0** |
| [LibreDWG](https://www.gnu.org/software/libredwg/) | DWG 読み込み（libredwg-web の中身） | **GPL-3.0** |
| [lodash-es](https://github.com/lodash/lodash) | ユーティリティ | MIT |
| [idb](https://github.com/jakearchibald/idb) | ブラウザ内の保存領域 | ISC |
| [tslib](https://github.com/Microsoft/tslib) / [polybool](https://github.com/velipso/polybool) | 補助ライブラリ | 0BSD |
| [Vite](https://github.com/vitejs/vite) | 組み立て（開発時のみ） | MIT |

上記はすべて GPL-3.0 と組み合わせて配布できるライセンスです（`npx license-checker --production` で確認）。

## フォントについて

DXF / DWG の文字表示用フォントは [mlightcad/cad-data](https://github.com/mlightcad/cad-data) のものを、実行時（または `npm run fonts` 実行時）に取得します。
再配布できないフォントが含まれるため、このリポジトリには同梱していません。
