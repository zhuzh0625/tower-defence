# 可扩展地表素材 v1

来源：内置 image_gen；以 battlefield-atlas-v1.png 为风格参考，新生成 ground-moss-v1.png。保留原始图片。

每片纹理固定覆盖 512 × 512 世界单位。按世界坐标铺设相邻镜像地块，复用同一张纹理并裁切地图边缘；扩图只增加地块，不放大整张背景。草丛、磨损及金属碎片按 192 单位的世界坐标单元确定性生成，基地铺装保持固定尺度。这些地表细节不参与碰撞。

## 完整提示词

Use case: stylized-concept.
Asset type: ONE seamless repeatable square top-down ground albedo texture for a detailed isometric strategy game. This is a flat ground material swatch, NOT an isometric scene, screenshot, map, or sprite sheet.
The attached sprite atlas is a STYLE AND PALETTE REFERENCE ONLY. Do not reproduce any robots, towers, buildings, boulders, technology, icons, or objects from it. Create only the subtle ground beneath those objects.
Material: an abandoned frontier outpost clearing reclaimed by nature: fine weathered gray-brown slate grit, compacted cool olive earth, low soft moss and very short muted sage grass, tiny scattered pebbles, faint dry cracks and scuffs. Rich hand-painted realistic game texture with fine brush detail, worn organic surfaces matching the reference's mossy rocks and green-and-ivory machinery. Broad softly blended irregular patches; earth occupies about half the area and low moss the other half. Slight warm ochre mineral dust, restrained desaturated blue-green shadows. Keep value predominantly medium-dark, contrast gentle; colorful small gameplay units must remain readable on top.
Orthographic straight-down view, no perspective, no directional shadows, no raised rocks or vegetation, no horizon, no cast shadows, no structures, no paths, no roads, no grid, no borders, no text. Uniform even lighting across the ENTIRE image, no spotlight or vignette. Nothing large or singular that reveals repetition.
SEAMLESS TILE: exact left/right and top/bottom edge color and texture continuity; no edge frame, don't concentrate moss at edges or center. Detailed across the entire canvas. Opaque image, high quality square texture, ideally 1024x1024.
