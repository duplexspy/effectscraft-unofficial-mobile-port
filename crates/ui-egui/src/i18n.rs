//! Japanese menu labels for EffectCraft's own engine tree. Commands remain locale-independent.
//! A command plus its source label distinguishes parameterised entries (e.g. blend modes).
//! Empty command keys identify submenus. Dynamic filenames, user names and effect plug-in names
//! remain verbatim; this catalog only translates the fixed menu tree.

use crate::EffectcraftApp;
use effectcraft_engine::menus::MenuEntry;

pub(crate) fn japanese(app: &EffectcraftApp) -> bool {
    match app.session.prefs.general.language.as_str() {
        "system" => system_language() == "ja",
        l => l == "ja",
    }
}

/// Settings ▸ General ▸ Language ▸ Match System: the operating system's interface language
/// where EffectCraft has it, else English (#229), as After Effects installs in the system's
/// language. The browser build stays in English: it has no Japanese font of its own.
fn system_language() -> &'static str {
    #[cfg(not(target_arch = "wasm32"))]
    {
        static LANGUAGE: std::sync::OnceLock<&'static str> = std::sync::OnceLock::new();
        LANGUAGE.get_or_init(|| supported(sys_locale::get_locale().as_deref()))
    }
    // No system locale in the browser build: English.
    #[cfg(target_arch = "wasm32")]
    supported(None)
}

/// The language EffectCraft shows for a BCP 47 locale (`ja-JP` → `ja`).
fn supported(locale: Option<&str>) -> &'static str {
    match locale.and_then(|l| l.split(['-', '_']).next()) {
        Some(l) if l.eq_ignore_ascii_case("ja") => "ja",
        _ => "en",
    }
}

pub(crate) fn label<'a>(app: &EffectcraftApp, command: &str, source: &'a str) -> &'a str {
    if japanese(app) { JAPANESE.iter().find(|(id, en, _)| *id == command && *en == source).map(|(_, _, ja)| *ja).unwrap_or(source) } else { source }
}

pub(crate) fn entry(app: &EffectcraftApp, e: &MenuEntry, shown: String) -> String {
    if !japanese(app) {
        return shown;
    }
    match e.command.as_str() {
        "edit.undo" => app.session.history.undo.last().map(|u| format!("取り消し {}", u.0)).unwrap_or_else(|| "取り消しできません".into()),
        "edit.redo" => app.session.history.redo.last().map(|u| format!("やり直し {}", u.0)).unwrap_or_else(|| "やり直しできません".into()),
        "window.panel" => {
            let prefix = format!("{}: ", e.label);
            if let Some(name) = shown.strip_prefix(&prefix) {
                format!("{}: {name}", label(app, &e.command, &e.label))
            } else {
                label(app, &e.command, &shown).into()
            }
        }
        _ if shown == e.label => label(app, &e.command, &e.label).into(),
        // A computed label can contain a user's filename, layer or workspace name. Do not
        // look it up as a source label (a layer literally named "File" must stay "File").
        _ => shown,
    }
}

pub(crate) fn submenu(app: &EffectcraftApp, source: &str, shown: String) -> String {
    if japanese(app) {
        if source == "Assign Shortcut to Workspace" {
            if let Some(name) = shown.strip_prefix("Assign Shortcut to “").and_then(|s| s.strip_suffix("” Workspace")) {
                return format!("ワークスペース「{name}」にショートカットを割り当て");
            }
        } else if source == "Assign Shortcut to 3D View"
            && let Some(name) = shown.strip_prefix("Assign Shortcut to “").and_then(|s| s.strip_suffix('”'))
        {
            return format!("「{name}」にショートカットを割り当て");
        }
    }
    label(app, "", &shown).into()
}

const JAPANESE: &[(&str, &str, &str)] = &[
    ("", "EffectCraft", "EffectCraft"),
    ("app.about", "About EffectCraft...", "EffectCraftについて..."),
    ("", "Settings...", "設定..."),
    ("app.settings", "General...", "一般..."),
    ("app.settings", "Startup & Repair...", "起動と修復..."),
    ("app.settings", "Project...", "プロジェクト..."),
    ("app.settings", "Composition...", "コンポジション..."),
    ("app.settings", "Previews...", "プレビュー..."),
    ("app.settings", "Appearance...", "アピアランス..."),
    ("app.settings", "Grids & Guides...", "グリッドとガイド..."),
    ("app.settings", "Labels...", "ラベル..."),
    ("app.settings", "Type...", "テキスト..."),
    ("app.settings", "Import...", "読み込み..."),
    ("app.settings", "Export...", "書き出し..."),
    ("app.settings", "Audio...", "オーディオ..."),
    ("app.settings", "Disk...", "ディスク..."),
    ("app.settings", "Memory & CPU...", "メモリとCPU..."),
    ("app.settings", "Video...", "ビデオ..."),
    ("app.settings", "3D...", "3D..."),
    ("app.settings", "Scripting & Expressions...", "スクリプトとエクスプレッション..."),
    ("app.hide", "Hide EffectCraft", "EffectCraftを隠す"),
    ("app.hideOthers", "Hide Others", "ほかを隠す"),
    ("app.showAll", "Show All", "すべてを表示"),
    ("app.quit", "Quit EffectCraft", "EffectCraftを終了"),
    ("", "File", "ファイル"),
    ("", "New", "新規"),
    ("file.newProject", "New Project", "新規プロジェクト"),
    ("file.newFromTemplate", "New Project from Template...", "テンプレートから新規プロジェクト..."),
    ("project.newFolder", "New Folder", "新規フォルダー"),
    ("file.open", "Open Project...", "プロジェクトを開く..."),
    ("", "Open Recent", "最近使用したプロジェクトを開く"),
    ("file.clearRecent", "Clear Recent Projects", "最近使用したプロジェクトを消去"),
    ("file.close", "Close", "閉じる"),
    ("file.closeProject", "Close Project", "プロジェクトを閉じる"),
    ("file.save", "Save", "保存"),
    ("", "Save As", "別名で保存"),
    ("file.saveAs", "Save As...", "別名で保存..."),
    ("file.saveCopy", "Save a Copy...", "コピーを保存..."),
    ("file.saveCopyAsXml", "Save a Copy As XML...", "コピーをXMLとして保存..."),
    ("templates.saveAs", "Save as Template...", "テンプレートとして保存..."),
    ("file.incrementAndSave", "Increment and Save", "増分保存"),
    ("file.revert", "Revert", "復帰"),
    ("", "Import", "読み込み"),
    ("file.import", "File...", "ファイル..."),
    ("file.importMultiple", "Multiple Files...", "複数のファイル..."),
    ("file.importTimeline", "Adobe Premiere Pro Project...", "Adobe Premiere Proプロジェクト..."),
    ("file.importPlaceholder", "Placeholder...", "プレースホルダー..."),
    ("file.importSolid", "Solid...", "平面..."),
    ("file.importLottie", "Lottie...", "Lottie..."),
    ("file.importVanishingPoint", "Vanishing Point (.vpe)...", "Vanishing Point (.vpe)..."),
    ("essential.importTemplate", "Essential Graphics Template...", "エッセンシャルグラフィックステンプレート..."),
    ("", "Import Recent Footage", "最近使用したフッテージを読み込み"),
    ("file.clearRecentFootage", "Clear Recent Footage", "最近使用したフッテージを消去"),
    ("", "Export", "書き出し"),
    ("renderQueue.add", "Add to Render Queue", "レンダーキューに追加"),
    ("file.exportTimeline", "Adobe Premiere Pro Project...", "Adobe Premiere Proプロジェクト..."),
    ("file.exportLottie", "Lottie JSON...", "Lottie JSON..."),
    ("essential.exportTemplate", "Essential Graphics Template...", "エッセンシャルグラフィックステンプレート..."),
    ("app.find", "Find", "検索"),
    ("layer.addItem", "Add Footage to Comp", "フッテージをコンポジションに追加"),
    ("file.newCompFromSelection", "New Comp from Selection...", "選択範囲から新規コンポジション..."),
    ("", "Dependencies", "依存関係"),
    ("file.collectFiles", "Collect Files...", "ファイルを収集..."),
    ("file.consolidateFootage", "Consolidate All Footage", "すべてのフッテージを統合"),
    ("file.removeUnusedFootage", "Remove Unused Footage", "未使用のフッテージを削除"),
    ("file.reduceProject", "Reduce Project", "プロジェクトを整理"),
    ("file.findMissing", "Find Missing Effects", "見つからないエフェクトを検索"),
    ("file.findMissing", "Find Missing Fonts", "見つからないフォントを検索"),
    ("file.findMissing", "Find Missing Footage", "見つからないフッテージを検索"),
    ("file.watchFolder", "Watch Folder...", "監視フォルダー..."),
    ("", "Scripts", "スクリプト"),
    ("file.installScript", "Install Script File...", "スクリプトファイルをインストール..."),
    ("file.installScriptUIPanel", "Install ScriptUI Panel...", "ScriptUIパネルをインストール..."),
    ("file.runScript", "Run Script File...", "スクリプトファイルを実行..."),
    ("", "Create Proxy", "プロキシを作成"),
    ("file.createProxy", "Still...", "静止画..."),
    ("file.createProxy", "Movie...", "ムービー..."),
    ("", "Set Proxy", "プロキシを設定"),
    ("file.setProxy", "File...", "ファイル..."),
    ("file.setProxyNone", "None", "なし"),
    ("", "Interpret Footage", "フッテージを変換"),
    ("file.interpretFootage", "Main...", "メイン..."),
    ("file.interpretProxy", "Proxy...", "プロキシ..."),
    ("file.rememberInterpretation", "Remember Interpretation", "変換設定を記憶"),
    ("file.applyInterpretation", "Apply Interpretation", "変換設定を適用"),
    ("", "Replace Footage", "フッテージを置き換え"),
    ("file.replaceFootage", "File...", "ファイル..."),
    ("file.replaceWithPlaceholder", "Placeholder...", "プレースホルダー..."),
    ("file.replaceWithSolid", "Solid...", "平面..."),
    ("file.replaceWithLayeredComp", "With Layered Comp", "レイヤーを含むコンポジションに置き換え"),
    ("file.reloadFootage", "Reload Footage", "フッテージを再読み込み"),
    ("file.revealInFinder", "Reveal in Finder", "Finderで表示"),
    ("file.projectSettings", "Project Settings...", "プロジェクト設定..."),
    ("app.quit", "Exit", "終了"),
    ("", "Edit", "編集"),
    ("edit.undo", "Undo", "取り消し"),
    ("edit.redo", "Redo", "やり直し"),
    ("", "History", "履歴"),
    ("app.commandPalette", "Quick Apply...", "クイック適用..."),
    ("edit.cut", "Cut", "カット"),
    ("edit.copy", "Copy", "コピー"),
    ("edit.copyWithPropertyLinks", "Copy with Property Links", "プロパティリンク付きでコピー"),
    ("edit.copyWithRelativePropertyLinks", "Copy with Relative Property Links", "相対プロパティリンク付きでコピー"),
    ("edit.copyExpressionOnly", "Copy Expression Only", "エクスプレッションのみをコピー"),
    ("edit.paste", "Paste", "ペースト"),
    ("edit.pasteReversedKeyframes", "Paste Reversed Keyframes", "逆順にキーフレームをペースト"),
    ("edit.pasteTextMatchFormatting", "Paste Text and Match Formatting", "書式を合わせてテキストをペースト"),
    ("edit.pasteTextFormattingOnly", "Paste Text Formatting Only", "テキストの書式のみをペースト"),
    ("edit.clear", "Clear", "消去"),
    ("edit.duplicate", "Duplicate", "複製"),
    ("edit.splitLayer", "Split Layer", "レイヤーを分割"),
    ("edit.liftWorkArea", "Lift Work Area", "ワークエリアをリフト"),
    ("edit.extractWorkArea", "Extract Work Area", "ワークエリアを抽出"),
    ("edit.selectAll", "Select All", "すべてを選択"),
    ("edit.deselectAll", "Deselect All", "すべての選択を解除"),
    ("", "Label", "ラベル"),
    ("edit.selectLabelGroup", "Select Label Group", "ラベルグループを選択"),
    ("edit.label", "None", "なし"),
    ("edit.label", "Red", "レッド"),
    ("edit.label", "Yellow", "イエロー"),
    ("edit.label", "Aqua", "アクア"),
    ("edit.label", "Pink", "ピンク"),
    ("edit.label", "Lavender", "ラベンダー"),
    ("edit.label", "Peach", "ピーチ"),
    ("edit.label", "Sea Foam", "シーフォーム"),
    ("edit.label", "Blue", "ブルー"),
    ("edit.label", "Green", "グリーン"),
    ("edit.label", "Purple", "パープル"),
    ("edit.label", "Orange", "オレンジ"),
    ("edit.label", "Brown", "ブラウン"),
    ("edit.label", "Fuchsia", "フクシア"),
    ("edit.label", "Cyan", "シアン"),
    ("edit.label", "Sandstone", "サンドストーン"),
    ("edit.label", "Dark Green", "ダークグリーン"),
    ("app.settings", "Edit Label Colors...", "ラベルカラーを編集..."),
    ("", "Select Keyframe Label Group", "キーフレームのラベルグループを選択"),
    ("keys.selectLabelGroup", "On Selected Layers", "選択したレイヤー上"),
    ("keys.selectLabelGroup", "On All Layers", "すべてのレイヤー上"),
    ("keys.selectLabelGroup", "Visible Keyframes on Selected Layers", "選択したレイヤー上の表示キーフレーム"),
    ("keys.selectLabelGroup", "Visible Keyframes on All Layers", "すべてのレイヤー上の表示キーフレーム"),
    ("", "Purge", "キャッシュを消去"),
    ("edit.purge", "All Cache...", "すべてのキャッシュ..."),
    ("edit.purge", "All Memory & Disk Cache...", "すべてのメモリおよびディスクキャッシュ..."),
    ("edit.purge", "All Memory", "すべてのメモリ"),
    ("edit.purge", "All Disk Cache...", "すべてのディスクキャッシュ..."),
    ("edit.purge", "All 3D Cache...", "すべての3Dキャッシュ..."),
    ("edit.purgeUndo", "Undo", "取り消し"),
    ("edit.purge", "Image Cache Memory", "イメージキャッシュメモリ"),
    ("edit.purge", "Snapshot", "スナップショット"),
    ("edit.editOriginal", "Edit Original...", "オリジナルを編集..."),
    ("", "Templates", "テンプレート"),
    ("app.templates", "Render Settings...", "レンダリング設定..."),
    ("app.templates", "Output Module...", "出力モジュール..."),
    ("app.keyboardShortcuts", "Keyboard Shortcuts", "キーボードショートカット"),
    ("", "Preferences", "環境設定"),
    ("", "Composition", "コンポジション"),
    ("comp.new", "New Composition...", "新規コンポジション..."),
    ("comp.settings", "Composition Settings...", "コンポジション設定..."),
    ("comp.setPosterTime", "Set Poster Time", "ポスター時間を設定"),
    ("comp.trimToWorkArea", "Trim Comp to Work Area", "コンポジションをワークエリアにトリミング"),
    ("comp.cropToRegionOfInterest", "Crop Comp to Region of Interest", "コンポジションを目標範囲にクロップ"),
    ("comp.cropToLayerBounds", "Crop Comp to Selected Layer(s) Bounds", "コンポジションを選択レイヤーの境界にクロップ"),
    ("render.addOutputModule", "Add Output Module", "出力モジュールを追加"),
    ("", "Preview", "プレビュー"),
    ("playback.toggle", "Play Current Preview", "現在のプレビューを再生"),
    ("playback.cacheWhenIdle", "Cache Frames When Idle", "アイドル時にフレームをキャッシュ"),
    ("playback.audio", "Audio", "オーディオ"),
    ("", "Save Frame As", "フレームを保存"),
    ("comp.saveFrameAs", "File...", "ファイル..."),
    ("comp.saveFrameAsPsd", "Photoshop Layers...", "Photoshopレイヤー..."),
    ("comp.saveFrameAsExr", "ProEXR...", "ProEXR..."),
    ("render.preRender", "Pre-render...", "プリレンダリング..."),
    ("render.saveCurrentPreview", "Save Current Preview...", "現在のプレビューを保存..."),
    ("comp.openInEssentialGraphics", "Open in Essential Graphics", "エッセンシャルグラフィックスで開く"),
    ("", "Responsive Design — Time", "レスポンシブデザイン — 時間"),
    ("comp.responsiveTime", "Create Intro", "イントロを作成"),
    ("comp.responsiveTime", "Create Outro", "アウトロを作成"),
    ("comp.responsiveTime", "Create Protected Region from Work Area", "ワークエリアから保護領域を作成"),
    ("comp.flowchart", "Composition Flowchart", "コンポジションフローチャート"),
    ("comp.miniFlowchart", "Composition Mini-Flowchart", "コンポジションミニフローチャート"),
    ("", "VR", "VR"),
    ("comp.vr.createEnvironment", "Create VR Environment...", "VR環境を作成..."),
    ("comp.vr.extractCubemap", "Extract Cubemap...", "キューブマップを抽出..."),
    ("", "Layer", "レイヤー"),
    ("layer.newText", "Text", "テキスト"),
    ("layer.newSolid", "Solid...", "平面..."),
    ("layer.newLight", "Light...", "ライト..."),
    ("layer.newCamera", "Camera...", "カメラ..."),
    ("layer.newNull", "Null Object", "ヌルオブジェクト"),
    ("layer.newShape", "Shape Layer", "シェイプレイヤー"),
    ("layer.newAdjustment", "Adjustment Layer", "調整レイヤー"),
    ("layer.newContentAwareFill", "Content-Aware Fill Layer...", "コンテンツに応じた塗りつぶしレイヤー..."),
    ("layer.new3dPrimitive", "Cube", "立方体"),
    ("layer.new3dPrimitive", "Sphere", "球体"),
    ("layer.new3dPrimitive", "Plane", "平面"),
    ("layer.new3dPrimitive", "Torus", "トーラス"),
    ("layer.new3dPrimitive", "Cone", "円錐"),
    ("layer.new3dPrimitive", "Cylinder", "円柱"),
    ("layer.settings", "Layer Settings...", "レイヤー設定..."),
    ("layer.openLayer", "Open Layer", "レイヤーを開く"),
    ("layer.openSource", "Open Layer Source", "レイヤーソースを開く"),
    ("layer.revealInFinder", "Reveal in Finder", "Finderで表示"),
    ("", "Mask", "マスク"),
    ("layer.addMask", "New Mask", "新規マスク"),
    ("layer.mask.shape", "Mask Shape...", "マスクのシェイプ..."),
    ("layer.mask.set", "Mask Feather...", "マスクの境界のぼかし..."),
    ("layer.mask.set", "Mask Opacity...", "マスクの不透明度..."),
    ("layer.mask.set", "Mask Expansion...", "マスクの拡張..."),
    ("layer.mask.reset", "Reset Mask", "マスクをリセット"),
    ("layer.mask.remove", "Remove Mask", "マスクを削除"),
    ("layer.mask.removeAll", "Remove All Masks", "すべてのマスクを削除"),
    ("track.mask", "Track Mask", "マスクをトラック"),
    ("", "Mode", "モード"),
    ("layer.mask.mode", "None", "なし"),
    ("layer.mask.mode", "Add", "加算"),
    ("layer.mask.mode", "Subtract", "減算"),
    ("layer.mask.mode", "Intersect", "交差"),
    ("layer.mask.mode", "Lighten", "比較（明）"),
    ("layer.mask.mode", "Darken", "比較（暗）"),
    ("layer.mask.mode", "Difference", "差"),
    ("layer.mask.invert", "Inverted", "反転"),
    ("layer.mask.lock", "Locked", "ロック"),
    ("", "Motion Blur", "モーションブラー"),
    ("layer.mask.motionBlur", "Same As Layer", "レイヤーと同じ"),
    ("layer.mask.motionBlur", "On", "オン"),
    ("layer.mask.motionBlur", "Off", "オフ"),
    ("", "Feather Falloff", "境界のぼかしの減衰"),
    ("layer.mask.featherFalloff", "Smooth", "スムーズ"),
    ("layer.mask.featherFalloff", "Linear", "リニア"),
    ("layer.mask.unlockAll", "Unlock All Masks", "すべてのマスクのロックを解除"),
    ("layer.mask.lockOthers", "Lock Other Masks", "ほかのマスクをロック"),
    ("layer.mask.hideLocked", "Hide Locked Masks", "ロックしたマスクを非表示"),
    ("", "Mask and Shape Path", "マスクとシェイプのパス"),
    ("path.rotoBezier", "RotoBezier", "ロトベジェ"),
    ("mask.setClosed", "Closed", "閉じたパス"),
    ("path.convertToBezier", "Convert To Bezier Path", "ベジェパスに変換"),
    ("path.setFirstVertex", "Set First Vertex", "最初の頂点を設定"),
    ("path.freeTransform", "Free Transform Points", "ポイントを自由変形"),
    ("", "Quality", "画質"),
    ("layer.quality", "Best", "最高"),
    ("layer.quality", "Draft", "ドラフト"),
    ("layer.quality", "Wireframe", "ワイヤーフレーム"),
    ("layer.sampling", "Bilinear", "バイリニア"),
    ("layer.sampling", "Bicubic", "バイキュービック"),
    ("", "Switches", "スイッチ"),
    ("layer.hideOtherVideo", "Hide Other Video", "ほかのビデオを非表示"),
    ("layer.showAllVideo", "Show All Video", "すべてのビデオを表示"),
    ("layer.unlockAll", "Unlock All Layers", "すべてのレイヤーのロックを解除"),
    ("layer.expressions", "Enable Expressions", "エクスプレッションを有効化"),
    ("layer.expressions", "Disable Expressions", "エクスプレッションを無効化"),
    ("layer.setSwitch", "Shy", "シャイ"),
    ("layer.setSwitch", "Lock", "ロック"),
    ("layer.setSwitch", "Audio", "オーディオ"),
    ("layer.setSwitch", "Video", "ビデオ"),
    ("layer.setSwitch", "Solo", "ソロ"),
    ("layer.setSwitch", "Effect", "エフェクト"),
    ("layer.setSwitch", "Collapse", "コラップス"),
    ("layer.setSwitch", "Motion Blur", "モーションブラー"),
    ("layer.setSwitch", "Adjustment Layer", "調整レイヤー"),
    ("", "Transform", "トランスフォーム"),
    ("layer.transform", "Reset", "リセット"),
    ("layer.setTransform", "Anchor Point...", "アンカーポイント..."),
    ("layer.setTransform", "Position...", "位置..."),
    ("layer.setTransform", "Scale...", "スケール..."),
    ("layer.setTransform", "Orientation...", "方向..."),
    ("layer.setTransform", "Rotation...", "回転..."),
    ("layer.setTransform", "Opacity...", "不透明度..."),
    ("layer.transform", "Flip Horizontal", "水平方向に反転"),
    ("layer.transform", "Flip Vertical", "垂直方向に反転"),
    ("layer.transform", "Center In View", "ビューの中央に配置"),
    ("layer.centerAnchor", "Center Anchor Point in Layer Content", "アンカーポイントをレイヤーコンテンツの中央に配置"),
    ("layer.transform", "Fit to Comp", "コンポジションに合わせる"),
    ("layer.transform", "Fit to Comp Width", "コンポジションの幅に合わせる"),
    ("layer.transform", "Fit to Comp Height", "コンポジションの高さに合わせる"),
    ("layer.autoOrient", "Auto-Orient...", "自動方向..."),
    ("", "Time", "時間"),
    ("layer.enableTimeRemap", "Enable Time Remapping", "タイムリマップ使用可能"),
    ("layer.timeReverse", "Time-Reverse Layer", "時間反転レイヤー"),
    ("layer.timeStretch", "Time Stretch...", "時間伸縮..."),
    ("layer.freezeFrame", "Freeze Frame", "フレームを固定"),
    ("layer.freezeOnLastFrame", "Freeze On Last Frame", "最後のフレームで固定"),
    ("layer.alignVideoToData", "Align Video to Data", "ビデオをデータに整列"),
    ("", "Frame Blending", "フレームブレンド"),
    ("layer.frameBlending", "Off", "オフ"),
    ("layer.frameBlending", "Frame Mix", "フレームミックス"),
    ("layer.frameBlending", "Pixel Motion", "ピクセルモーション"),
    ("layer.setSwitch", "3D Layer", "3Dレイヤー"),
    ("layer.setSwitch", "Guide Layer", "ガイドレイヤー"),
    ("layer.environment", "Environment Layer", "環境レイヤー"),
    ("", "Markers", "マーカー"),
    ("layer.addMarker", "Add Marker", "マーカーを追加"),
    ("layer.updateMarkersFromSource", "Update Markers From Source", "ソースからマーカーを更新"),
    ("layer.markersLock", "Lock Markers", "マーカーをロック"),
    ("layer.deleteAllMarkers", "Delete All Markers", "すべてのマーカーを削除"),
    ("layer.setSwitch", "Preserve Transparency", "透明部分を保持"),
    ("", "Blending Mode", "描画モード"),
    ("layer.setBlendMode", "Normal", "通常"),
    ("layer.setBlendMode", "Dissolve", "ディザ合成"),
    ("layer.setBlendMode", "Dancing Dissolve", "ダイナミックディザ合成"),
    ("layer.setBlendMode", "Darken", "比較（暗）"),
    ("layer.setBlendMode", "Multiply", "乗算"),
    ("layer.setBlendMode", "Color Burn", "焼き込みカラー"),
    ("layer.setBlendMode", "Classic Color Burn", "焼き込みカラー（クラシック）"),
    ("layer.setBlendMode", "Linear Burn", "焼き込みリニア"),
    ("layer.setBlendMode", "Darker Color", "カラー比較（暗）"),
    ("layer.setBlendMode", "Add", "加算"),
    ("layer.setBlendMode", "Lighten", "比較（明）"),
    ("layer.setBlendMode", "Screen", "スクリーン"),
    ("layer.setBlendMode", "Color Dodge", "覆い焼きカラー"),
    ("layer.setBlendMode", "Classic Color Dodge", "覆い焼きカラー（クラシック）"),
    ("layer.setBlendMode", "Linear Dodge", "覆い焼きリニア"),
    ("layer.setBlendMode", "Lighter Color", "カラー比較（明）"),
    ("layer.setBlendMode", "Overlay", "オーバーレイ"),
    ("layer.setBlendMode", "Soft Light", "ソフトライト"),
    ("layer.setBlendMode", "Hard Light", "ハードライト"),
    ("layer.setBlendMode", "Linear Light", "リニアライト"),
    ("layer.setBlendMode", "Vivid Light", "ビビッドライト"),
    ("layer.setBlendMode", "Pin Light", "ピンライト"),
    ("layer.setBlendMode", "Hard Mix", "ハードミックス"),
    ("layer.setBlendMode", "Difference", "差"),
    ("layer.setBlendMode", "Classic Difference", "差（クラシック）"),
    ("layer.setBlendMode", "Exclusion", "除外"),
    ("layer.setBlendMode", "Subtract", "減算"),
    ("layer.setBlendMode", "Divide", "除算"),
    ("layer.setBlendMode", "Hue", "色相"),
    ("layer.setBlendMode", "Saturation", "彩度"),
    ("layer.setBlendMode", "Color", "カラー"),
    ("layer.setBlendMode", "Luminosity", "輝度"),
    ("layer.setBlendMode", "Stencil Alpha", "ステンシルアルファ"),
    ("layer.setBlendMode", "Stencil Luma", "ステンシルルミナンス"),
    ("layer.setBlendMode", "Silhouette Alpha", "シルエットアルファ"),
    ("layer.setBlendMode", "Silhouette Luma", "シルエットルミナンス"),
    ("layer.setBlendMode", "Alpha Add", "アルファ加算"),
    ("layer.setBlendMode", "Luminescent Premul", "ルミナンスプリマルチプライ"),
    ("layer.setBlendMode", "Next Blending Mode", "次の描画モード"),
    ("layer.setBlendMode", "Previous Blending Mode", "前の描画モード"),
    ("", "Track Matte", "トラックマット"),
    ("layer.trackMatte", "No Track Matte", "トラックマットなし"),
    ("layer.trackMatte", "Alpha Matte", "アルファマット"),
    ("layer.trackMatte", "Alpha Inverted Matte", "アルファ反転マット"),
    ("layer.trackMatte", "Luma Matte", "ルミナンスマット"),
    ("layer.trackMatte", "Luma Inverted Matte", "ルミナンス反転マット"),
    ("layer.trackMatte", "Matte with Layer Above", "上のレイヤーをマットにする"),
    ("layer.trackMatte", "Matte with Layer Below", "下のレイヤーをマットにする"),
    ("", "Layer Styles", "レイヤースタイル"),
    ("layer.style.options", "Layer Style Options...", "レイヤースタイルオプション..."),
    ("layer.style.convertToEditable", "Convert to Editable Styles", "編集可能なスタイルに変換"),
    ("layer.style.showAll", "Show All", "すべてを表示"),
    ("layer.style.removeAll", "Remove All", "すべてを削除"),
    ("layer.style.dropShadow", "Drop Shadow", "ドロップシャドウ"),
    ("layer.style.innerShadow", "Inner Shadow", "シャドウ（内側）"),
    ("layer.style.outerGlow", "Outer Glow", "光彩（外側）"),
    ("layer.style.innerGlow", "Inner Glow", "光彩（内側）"),
    ("layer.style.bevelEmboss", "Bevel and Emboss", "ベベルとエンボス"),
    ("layer.style.satin", "Satin", "サテン"),
    ("layer.style.colorOverlay", "Color Overlay", "カラーオーバーレイ"),
    ("layer.style.gradientOverlay", "Gradient Overlay", "グラデーションオーバーレイ"),
    ("layer.style.stroke", "Stroke", "境界線"),
    ("path.groupShapes", "Group Shapes", "シェイプをグループ化"),
    ("path.ungroupShapes", "Ungroup Shapes", "シェイプのグループ化を解除"),
    ("", "Arrange", "重ね順"),
    ("layer.arrange", "Bring Layer to Front", "レイヤーを最前面へ"),
    ("layer.arrange", "Bring Layer Forward", "レイヤーを前面へ"),
    ("layer.arrange", "Send Layer Backward", "レイヤーを背面へ"),
    ("layer.arrange", "Send Layer to Back", "レイヤーを最背面へ"),
    ("", "Reveal", "表示"),
    ("layer.revealSource", "Reveal Layer Source in Project", "プロジェクト内のレイヤーソースを表示"),
    ("comp.flowchart", "Reveal Layer in Project Flowchart", "プロジェクトフローチャート内のレイヤーを表示"),
    ("comp.revealInProject", "Reveal Composition in Project", "プロジェクト内のコンポジションを表示"),
    ("layer.revealExpressionErrors", "Reveal Expression Errors", "エクスプレッションエラーを表示"),
    ("", "Create", "作成"),
    ("layer.create", "Convert to Editable Text", "編集可能なテキストに変換"),
    ("layer.create", "Create Shapes from Text", "テキストからシェイプを作成"),
    ("layer.create", "Create Masks from Text", "テキストからマスクを作成"),
    ("layer.create", "Create Shapes from Vector Layer", "ベクトルレイヤーからシェイプを作成"),
    ("layer.create", "Create Keyframes from Data", "データからキーフレームを作成"),
    ("layer.create", "Null Controllers for Positional Points", "位置のポイント用ヌルコントローラー"),
    ("layer.create", "Null Controllers for Path Points", "パスのポイント用ヌルコントローラー"),
    ("layer.create", "Nulls Following Path Points", "パスのポイントに追従するヌル"),
    ("layer.create", "Null Tracing Along Path", "パスをトレースするヌル"),
    ("layer.create", "Create 3D Layer Instance", "3Dレイヤーインスタンスを作成"),
    ("", "Camera", "カメラ"),
    ("camera.fromView", "Create Camera from 3D View", "3Dビューからカメラを作成"),
    ("camera.stereoRig", "Create Stereo 3D Rig", "ステレオ3Dリグを作成"),
    ("camera.orbitNull", "Create Orbit Null", "周回用ヌルを作成"),
    ("camera.fromModel", "Create Cameras from 3D Model", "3Dモデルからカメラを作成"),
    ("camera.linkFocusToPoi", "Link Focus Distance to Point of Interest", "フォーカス距離を目標点にリンク"),
    ("camera.linkFocusToLayer", "Link Focus Distance to Layer", "フォーカス距離をレイヤーにリンク"),
    ("camera.setFocusToLayer", "Set Focus Distance to Layer", "フォーカス距離をレイヤーに設定"),
    ("layer.cameraSettings", "Camera Settings...", "カメラ設定..."),
    ("view.reset3DView", "Reset 3D View", "3Dビューをリセット"),
    ("", "Light", "ライト"),
    ("light.fromModel", "Create Lights from 3D Model", "3Dモデルからライトを作成"),
    ("light.controlWithCamera", "Control Light with Camera", "カメラでライトを制御"),
    ("light.environmentBackground", "Create Environment Light Background Layer", "環境ライトの背景レイヤーを作成"),
    ("", "Material", "マテリアル"),
    ("material.revealSource", "Reveal Material Source in Project", "プロジェクト内のマテリアルソースを表示"),
    ("material.reset", "Reset Material", "マテリアルをリセット"),
    ("material.duplicateAssign", "Duplicate and Assign Material", "マテリアルを複製して割り当て"),
    ("layer.autoTrace", "Auto-trace...", "オートトレース..."),
    ("layer.precompose", "Pre-compose...", "プリコンポーズ..."),
    ("layer.sceneEditDetection", "Scene Edit Detection...", "シーン編集の検出..."),
    ("", "Effect", "エフェクト"),
    ("window.panel", "Effect Controls", "エフェクトコントロール"),
    ("effect.applyLast", "Last Effect", "最後に使用したエフェクト"),
    ("effect.removeAll", "Remove All", "すべてを削除"),
    ("effect.manage", "Manage Effects...", "エフェクトを管理..."),
    ("effect.plugins.load", "Load Effect Plug-in...", "エフェクトプラグインを読み込み..."),
    ("", "Animation", "アニメーション"),
    ("anim.savePreset", "Save Animation Preset...", "アニメーションプリセットを保存..."),
    ("anim.applyPreset", "Apply Animation Preset...", "アニメーションプリセットを適用..."),
    ("", "Recent Animation Presets", "最近使用したアニメーションプリセット"),
    ("anim.clearRecentPresets", "Clear Recent Presets", "最近使用したプリセットを消去"),
    ("anim.browsePresets", "Browse Presets...", "プリセットを参照..."),
    ("", "Text Animation Presets", "テキストアニメーションプリセット"),
    ("layer.applyTextPreset", "Typewriter", "タイプライター"),
    ("layer.applyTextPreset", "Fade Up Characters", "文字をフェードイン"),
    ("layer.applyTextPreset", "Bounce In Words", "単語をバウンスイン"),
    ("layer.applyTextPreset", "Tracking In", "トラッキングイン"),
    ("layer.applyTextPreset", "Scramble", "スクランブル"),
    ("layer.applyTextPreset", "Blur In", "ブラーイン"),
    ("layer.applyTextPreset", "Jitter", "ジッター"),
    ("layer.applyTextPreset", "Drop In Lines", "行をドロップイン"),
    ("anim.addKeyframe", "Add Keyframe", "キーフレームを追加"),
    ("keys.toggleHold", "Toggle Hold Keyframe", "停止したキーフレームの切り替え"),
    ("keys.interpolation", "Keyframe Interpolation...", "キーフレーム補間法..."),
    ("keys.velocity", "Keyframe Velocity...", "キーフレーム速度..."),
    ("", "Keyframe Assistant", "キーフレーム補助"),
    ("keys.audioToKeyframes", "Convert Audio to Keyframes", "オーディオをキーフレームに変換"),
    ("prop.convertExpressionToKeyframes", "Convert Expression to Keyframes", "エクスプレッションをキーフレームに変換"),
    ("keys.easyEase", "Easy Ease", "イージーイーズ"),
    ("keys.easyEaseIn", "Easy Ease In", "イージーイーズイン"),
    ("keys.easyEaseOut", "Easy Ease Out", "イージーイーズアウト"),
    ("keys.exponentialScale", "Exponential Scale", "指数スケール"),
    ("keys.rpfCameraImport", "RPF Camera Import", "RPFカメラの読み込み"),
    ("layer.sequence", "Sequence Layers...", "シーケンスレイヤー..."),
    ("keys.timeReverse", "Time-Reverse Keyframes", "時間反転キーフレーム"),
    ("", "Animate Text", "テキストをアニメート"),
    ("layer.enablePerChar3D", "Enable Per-character 3D", "文字ごとの3Dを使用可能にする"),
    ("layer.addTextAnimator", "Anchor Point", "アンカーポイント"),
    ("layer.addTextAnimator", "Position", "位置"),
    ("layer.addTextAnimator", "Scale", "スケール"),
    ("layer.addTextAnimator", "Skew", "傾斜"),
    ("layer.addTextAnimator", "Rotation", "回転"),
    ("layer.addTextAnimator", "Opacity", "不透明度"),
    ("layer.addTextAnimator", "All Transform Properties", "すべてのトランスフォームプロパティ"),
    ("", "Fill Color", "塗りのカラー"),
    ("layer.addTextAnimator", "RGB", "RGB"),
    ("layer.addTextAnimator", "Hue", "色相"),
    ("layer.addTextAnimator", "Saturation", "彩度"),
    ("layer.addTextAnimator", "Brightness", "明度"),
    ("", "Stroke Color", "線のカラー"),
    ("layer.addTextAnimator", "Stroke Width", "線幅"),
    ("layer.addTextAnimator", "Tracking", "トラッキング"),
    ("layer.addTextAnimator", "Line Anchor", "行のアンカー"),
    ("layer.addTextAnimator", "Line Spacing", "行間"),
    ("layer.addTextAnimator", "Character Offset", "文字のオフセット"),
    ("layer.addTextAnimator", "Character Value", "文字の値"),
    ("layer.addTextAnimator", "Blur", "ブラー"),
    ("text.animatorFontAxes", "Variable Font Axes", "可変フォントの軸"),
    ("", "Add Text Selector", "テキストセレクターを追加"),
    ("text.addSelector", "Range", "範囲"),
    ("text.addSelector", "Wiggly", "ウィグリー"),
    ("text.addSelector", "Expression", "エクスプレッション"),
    ("text.removeAllAnimators", "Remove All Text Animators", "すべてのテキストアニメーターを削除"),
    ("prop.setExpression", "Add Expression", "エクスプレッションを追加"),
    ("essential.addProperty", "Add Property to Essential Graphics", "エッセンシャルグラフィックスにプロパティを追加"),
    ("prop.separateDimensions", "Separate Dimensions", "次元に分割"),
    ("track.camera", "Track Camera", "カメラをトラック"),
    ("track.warpStabilizer", "Warp Stabilizer VFX", "ワープスタビライザーVFX"),
    ("track.motion", "Track Motion", "モーションをトラック"),
    ("track.stabilize", "Stabilize Motion", "モーションをスタビライズ"),
    ("track.property", "Track this Property", "このプロパティをトラック"),
    ("anim.reveal", "Reveal Properties with Keyframes", "キーフレームのあるプロパティを表示"),
    ("anim.reveal", "Reveal Properties with Animation", "アニメーションのあるプロパティを表示"),
    ("anim.reveal", "Reveal All Modified Properties", "変更されたすべてのプロパティを表示"),
    ("", "View", "表示"),
    ("view.newViewer", "New Viewer", "新規ビューアー"),
    ("view.splitLockedViewer", "Split with New Locked Viewer", "新規ロック済みビューアーで分割"),
    ("view.zoomIn", "Zoom In", "ズームイン"),
    ("view.zoomOut", "Zoom Out", "ズームアウト"),
    ("", "Resolution", "解像度"),
    ("view.res.full", "Full", "フル画質"),
    ("view.res.half", "Half", "1/2画質"),
    ("view.res.third", "Third", "1/3画質"),
    ("view.res.quarter", "Quarter", "1/4画質"),
    ("view.res.custom", "Custom...", "カスタム..."),
    ("view.displayColorManagement", "Use Display Color Management", "ディスプレイカラーマネジメントを使用"),
    ("", "Simulate Output", "出力をシミュレート"),
    ("view.simulateOutput", "No Output Simulation", "出力シミュレーションなし"),
    ("view.simulateOutput", "HDTV (Rec. 709)", "HDTV (Rec. 709)"),
    ("view.simulateOutput", "SDTV NTSC", "SDTV NTSC"),
    ("view.simulateOutput", "SDTV PAL", "SDTV PAL"),
    ("view.simulateOutput", "Legacy Macintosh RGB (Gamma 1.8)", "従来のMacintosh RGB（ガンマ1.8）"),
    ("view.simulateOutput", "Internet Standard RGB (sRGB)", "インターネット標準RGB (sRGB)"),
    ("view.simulateOutput", "UHDTV (Rec. 2020)", "UHDTV (Rec. 2020)"),
    ("view.simulateOutput", "Display P3", "Display P3"),
    ("view.simulateOutput", "Linear (1.0 Gamma)", "リニア（ガンマ1.0）"),
    ("view.customRgb", "My Custom RGB...", "カスタムRGB..."),
    ("view.simulateOutput", "Custom...", "カスタム..."),
    ("view.rulers", "Show Rulers", "定規を表示"),
    ("", "Panel Background Color", "パネル背景色"),
    ("view.panelBackground", "Black", "ブラック"),
    ("view.panelBackground", "Dark Gray", "ダークグレー"),
    ("view.panelBackground", "Medium Gray (Default)", "ミディアムグレー（初期設定）"),
    ("view.panelBackground", "Light Gray", "ライトグレー"),
    ("view.panelBackground", "White", "ホワイト"),
    ("view.panelBackground", "Custom", "カスタム"),
    ("view.panelBackground", "Select Custom Background Color...", "カスタム背景色を選択..."),
    ("view.guides", "Show Guides", "ガイドを表示"),
    ("view.snapToGuides", "Snap to Guides", "ガイドにスナップ"),
    ("view.lockGuides", "Lock Guides", "ガイドをロック"),
    ("view.addGuide", "Add Guide...", "ガイドを追加..."),
    ("view.clearGuides", "Clear Guides", "ガイドを消去"),
    ("view.importGuides", "Import Guides...", "ガイドを読み込み..."),
    ("view.exportGuides", "Export Guides...", "ガイドを書き出し..."),
    ("view.grid", "Show Grid", "グリッドを表示"),
    ("view.snapToGrid", "Snap to Grid", "グリッドにスナップ"),
    ("view.snapping", "Snapping", "スナップ"),
    ("view.options", "View Options...", "表示オプション..."),
    ("view.layerControls", "Show Layer Controls", "レイヤーコントロールを表示"),
    ("", "Switch View Layout", "ビューレイアウトを切り替え"),
    ("view.layout", "1 View", "1画面"),
    ("view.layout", "2 Views", "2画面"),
    ("view.layout", "4 Views", "4画面"),
    ("view.shareViewOptions", "Share View Options", "表示オプションを共有"),
    ("", "Switch 3D View", "3Dビューを切り替え"),
    ("view.3d.activeCamera", "Active Camera", "アクティブカメラ"),
    ("view.3d.default", "Default", "初期設定"),
    ("view.3d.front", "Front", "フロント"),
    ("view.3d.left", "Left", "レフト"),
    ("view.3d.top", "Top", "トップ"),
    ("view.3d.back", "Back", "バック"),
    ("view.3d.right", "Right", "ライト"),
    ("view.3d.bottom", "Bottom", "ボトム"),
    ("view.3d.custom1", "Custom View 1", "カスタムビュー1"),
    ("view.3d.custom2", "Custom View 2", "カスタムビュー2"),
    ("view.3d.custom3", "Custom View 3", "カスタムビュー3"),
    ("", "Assign Shortcut to 3D View", "3Dビューにショートカットを割り当て"),
    ("view.3d.last", "Switch to Last 3D View", "最後の3Dビューに切り替え"),
    ("view.lookAtSelected", "Look at Selected Layers", "選択したレイヤーを見る"),
    ("view.lookAtAll", "Look at All Layers", "すべてのレイヤーを見る"),
    ("time.set", "Go to Time...", "時間へ移動..."),
    ("view.fullScreen", "Enter Full Screen", "フルスクリーンにする"),
    ("", "Window", "ウィンドウ"),
    ("", "Workspace", "ワークスペース"),
    ("window.workspace", "Default", "初期設定"),
    ("window.workspace", "Review", "レビュー"),
    ("window.workspace", "Learn", "学習"),
    ("window.workspace", "Small Screen", "小画面"),
    ("window.workspace", "Standard", "標準"),
    ("window.workspace", "All Panels", "すべてのパネル"),
    ("window.workspace", "Animation", "アニメーション"),
    ("window.workspace", "Color", "カラー"),
    ("window.workspace", "Effects", "エフェクト"),
    ("window.workspace", "Essential Graphics", "エッセンシャルグラフィックス"),
    ("window.workspace", "Minimal", "最小"),
    ("window.workspace", "Motion Tracking", "モーショントラッキング"),
    ("window.workspace", "Paint", "ペイント"),
    ("window.workspace", "Text", "テキスト"),
    ("window.workspace", "Undocked Panels", "ドッキング解除したパネル"),
    ("window.resetWorkspace", "Reset to Saved Layout", "保存したレイアウトにリセット"),
    ("window.saveWorkspace", "Save Changes to this Workspace", "このワークスペースの変更を保存"),
    ("window.saveWorkspaceAs", "Save as New Workspace...", "新規ワークスペースとして保存..."),
    ("window.editWorkspaces", "Edit Workspaces...", "ワークスペースを編集..."),
    ("", "Assign Shortcut to Workspace", "ワークスペースにショートカットを割り当て"),
    ("window.panel", "Align", "整列"),
    ("window.panel", "Audio", "オーディオ"),
    ("window.panel", "Brushes", "ブラシ"),
    ("window.panel", "Character", "文字"),
    ("window.panel", "Content-Aware Fill", "コンテンツに応じた塗りつぶし"),
    ("window.panel", "Effects & Presets", "エフェクト＆プリセット"),
    ("window.panel", "Essential Graphics", "エッセンシャルグラフィックス"),
    ("window.panel", "Info", "情報"),
    ("help.inAppTutorials", "Learn", "学習"),
    ("window.panel", "Lumetri Scopes", "Lumetriスコープ"),
    ("window.panel", "Mask Interpolation", "マスク補間"),
    ("window.panel", "Media Browser", "メディアブラウザー"),
    ("window.panel", "Metadata", "メタデータ"),
    ("window.panel", "Motion Sketch", "モーションスケッチ"),
    ("window.panel", "Paint", "ペイント"),
    ("window.panel", "Paragraph", "段落"),
    ("window.panel", "Preview", "プレビュー"),
    ("window.panel", "Progress", "進行状況"),
    ("window.panel", "Properties", "プロパティ"),
    ("window.panel", "Script Console", "スクリプトコンソール"),
    ("window.panel", "Smoother", "スムーザー"),
    ("window.panel", "Tools", "ツール"),
    ("window.panel", "Tracker", "トラッカー"),
    ("window.panel", "Wiggler", "ウィグラー"),
    ("window.panel", "Composition", "コンポジション"),
    ("window.panel", "Flowchart", "フローチャート"),
    ("window.panel", "Footage", "フッテージ"),
    ("window.panel", "Layer", "レイヤー"),
    ("window.panel", "Project", "プロジェクト"),
    ("window.panel", "Render Queue", "レンダーキュー"),
    ("window.panel", "Timeline", "タイムライン"),
    ("window.panel", "Create Nulls From Paths", "パスからヌルを作成"),
    ("window.panel", "Ease Presets", "イーズプリセット"),
    ("window.panel", "VR Comp Editor", "VRコンポジションエディター"),
    ("", "Help", "ヘルプ"),
    ("help.docs", "EffectCraft Help...", "EffectCraftヘルプ..."),
    ("help.docs", "Scripting Help...", "スクリプトヘルプ..."),
    ("help.docs", "Expression Reference...", "エクスプレッションリファレンス..."),
    ("help.docs", "Effect Reference...", "エフェクトリファレンス..."),
    ("anim.browsePresets", "Animation Presets...", "アニメーションプリセット..."),
    ("app.keyboardShortcuts", "Keyboard Shortcuts...", "キーボードショートカット..."),
    ("help.inAppTutorials", "In-App Tutorials...", "アプリ内チュートリアル..."),
    ("help.onlineTutorials", "Online Tutorials...", "オンラインチュートリアル..."),
    ("help.systemReport", "System Compatibility Report...", "システム互換性レポート..."),
    ("help.enableLogging", "Enable Logging", "ログ記録を有効化"),
    ("help.revealLogFile", "Reveal Logging File", "ログファイルを表示"),
    ("help.discord", "Join the ArtCraft Discord...", "ArtCraft Discordに参加..."),
    ("help.reportIssue", "Provide Feedback...", "フィードバックを送信..."),
    ("help.website", "ArtCraft Website", "ArtCraftウェブサイト"),
    ("help.appPage", "EffectCraft Home Page", "EffectCraftホームページ"),
    ("help.github", "EffectCraft on GitHub", "GitHubのEffectCraft"),
    ("file.openDemoProject", "Open Demo Project", "デモプロジェクトを開く"),
];

#[cfg(test)]
mod tests {
    use super::*;
    use effectcraft_engine::menus::{MenuNode, TREE, parse};
    use serde_json::json;
    use std::collections::BTreeSet;

    fn keys(nodes: &[MenuNode], out: &mut BTreeSet<(String, String)>) {
        for node in nodes {
            match node {
                MenuNode::Item(e) => {
                    out.insert((e.command.clone(), e.label.clone()));
                }
                MenuNode::Submenu { label, children } => {
                    out.insert((String::new(), label.clone()));
                    keys(children, out);
                }
                _ => {}
            }
        }
    }

    #[test]
    fn every_translation_key_exists_in_the_actual_menu_tree() {
        let mut actual = BTreeSet::new();
        for mac in [false, true] {
            keys(&parse(TREE, mac).unwrap(), &mut actual);
        }
        let mut unique = BTreeSet::new();
        for (command, en, ja) in JAPANESE {
            let key = (command.to_string(), en.to_string());
            assert!(actual.contains(&key), "stale translation: {key:?}");
            assert!(unique.insert(key), "duplicate translation: {command} / {en}");
            assert!(!ja.is_empty());
        }
        // All fixed TREE entries are covered; @effects is a generated plug-in catalog,
        // whose product/effect names are intentionally left as registered.
        for line in TREE.lines() {
            let line = line.trim().trim_start_matches("[mac] ").trim_start_matches("[!mac] ");
            if line.is_empty() || line == "---" || line.starts_with('@') {
                continue;
            }
            let mut parts = line.split(" | ");
            let en = parts.next().unwrap();
            let command = parts.next().and_then(|p| p.split_whitespace().next()).unwrap_or("");
            assert!(unique.contains(&(command.into(), en.into())), "untranslated fixed entry: {line}");
        }
    }

    #[test]
    fn language_changes_native_labels_without_changing_commands_or_parameters() {
        let mut app = EffectcraftApp::new(effectcraft_engine::Session::default());
        app.session.execute("prefs.set", json!({"key":"general.language", "value":"en"})).unwrap();
        let en = crate::native_menu::build(&app);
        let state = crate::native_menu::state_key(&app);
        app.session.execute("prefs.set", json!({"key":"general.language", "value":"ja"})).unwrap();
        assert_ne!(state, crate::native_menu::state_key(&app));
        let ja = crate::native_menu::build(&app);
        let bindings = |menu: &crate::native_menu::NativeMenu| {
            menu.items().into_iter().map(|i| (i.id.clone(), i.command.clone(), i.params.clone(), i.shortcut.clone(), i.enabled, i.checked)).collect::<Vec<_>>()
        };
        assert_eq!(bindings(&en), bindings(&ja));
        assert_eq!(label(&app, "unknown.command", "Text"), "Text");
        assert_eq!(
            entry(
                &app,
                &MenuEntry { label: "Layer".into(), command: "window.panel".into(), params: json!({"panel":"layer"}), shortcut: None },
                "Layer: File".into()
            ),
            "レイヤー: File"
        );
        assert!(ja.items().iter().any(|i| i.command == "comp.new" && i.label == "新規コンポジション..."));
        assert!(ja.items().iter().any(|i| i.command == "layer.newText" && i.label == "テキスト"));
        assert!(ja.items().iter().any(|i| i.command == "keys.easyEase" && i.label == "イージーイーズ"));
        app.session.prefs.push_recent("/tmp/File.ecproj");
        assert!(crate::native_menu::build(&app).items().iter().any(|i| i.command == "file.openRecent" && i.label == "File.ecproj"));
        app.session.execute("prefs.set", json!({"key":"general.language", "value":"en"})).unwrap();
        assert_eq!(label(&app, "", "Composition"), "Composition");
    }
    #[test]
    fn match_system_uses_the_system_language_where_there_is_a_catalog() {
        for (locale, language) in [
            (Some("ja-JP"), "ja"),
            (Some("ja"), "ja"),
            (Some("JA_jp.UTF-8"), "ja"),
            (Some("en-US"), "en"),
            (Some("jv-ID"), "en"),
            (Some("de-DE"), "en"),
            (None, "en"),
        ] {
            assert_eq!(supported(locale), language, "{locale:?}");
        }
        let mut app = EffectcraftApp::new(effectcraft_engine::Session::default());
        assert_eq!(app.session.prefs.general.language, "system", "the default");
        assert_eq!(japanese(&app), system_language() == "ja");
        app.session.execute("prefs.set", json!({"key":"general.language", "value":"ja"})).unwrap();
        assert!(japanese(&app));
    }

    #[test]
    fn general_settings_exposes_the_language_automation_id() {
        let mut app = EffectcraftApp::new(effectcraft_engine::Session::default());
        let ctx = egui::Context::default();
        let tokens = crate::theme::Tokens::for_kind(crate::theme::ThemeKind::Dark);
        crate::theme::install(&ctx, &tokens);
        crate::panels::settings::open(&mut app, "general");
        let mut out = ctx.run_ui(egui::RawInput::default(), |_| {
            crate::panels::settings::show(&mut app, &ctx, &tokens);
        });
        // No renderer here: drop the frame's texture uploads (egui asserts on unhandled ones in debug).
        out.textures_delta.clear();
        assert!(app.auto.find("settings.general.language").is_some());
    }
}
