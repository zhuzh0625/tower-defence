# 战场素材 v1

使用内置 image_gen 生成透明 PNG 图集。原始输出保持不变；游戏仅按帧裁切取样。

风格：45 度等轴视角、手绘金属装甲、青绿阴影、暖色高光、发光反应堆与苔藓岩石。炮管在游戏内单独绘制并随目标旋转，人物用朝向翻转和步态摆动表现移动。

布局：4 × 4。依次为基地、机炮底座、榴弹炮底座、冰霜塔、狙击底座、电弧塔、游荡者、疾行者、破阵者、掠火者、裂地者、铁甲卫士、狂奔者、医疗兵、岩石 A、岩石 B。

此文件仅记录素材来源与提示词；不改变碰撞、射程、数值或寻路。

## 生成提示词

Use case: stylized-concept.
Asset type: production game sprite atlas, ONE square 2048x2048 PNG with actual transparent background, exactly 4 columns x 4 rows of equal 512x512 cells. This is one cohesive sprite sheet for an isometric tower defense game, not a screenshot or scene.
Style: richly hand-painted premium strategy-game assets, believable worn metal, machined panels, bolts, soft bevels, warm ivory edge highlights, deep blue-green shadows, clean readable silhouettes, subtle surface texture. NOT flat icons, NOT stacked polygons, NOT low-poly primitives. Consistent orthographic isometric camera 45 degrees elevation, view from southeast. Light from upper left. Each object isolated within its own cell, centered horizontally; consistent generous empty margin, no part crosses cells. No labels, no text, no border, no scenery, no ground tile or opaque backdrop, no heavy cast shadows.
Rows in EXACT order left-to-right:
Row 1: (1) jade-green command bunker with rounded armored housing, a luminous mint reactor chimney, amber portholes, antenna, reinforced ivory panels, circular foundation; (2) compact green autocannon emplacement CHASSIS ONLY, squat circular base, mechanical pedestal, a visible small round mint swivel socket on top, NO gun barrels; (3) heavier brass-and-olive artillery emplacement CHASSIS ONLY, rugged circular armored platform with hydraulic supports, amber swivel socket on top, NO gun barrel; (4) elegant cyan frost generator tower with blue crystal held between metal claws on a circular industrial base.
Row 2: (1) ivory-and-copper sniper emplacement CHASSIS ONLY, compact industrial armored pedestal, coral round swivel socket on top, NO barrel; (2) violet tesla generator, two metal coil rings around a luminous violet core on circular green industrial base; (3) small rust-orange scavenger robot, two mechanical legs, compact armored torso with single glowing orange eye, facing lower-right; (4) fast sand-colored insectoid scout robot with four thin articulated legs, bright orange sensor, facing lower-right.
Row 3: (1) heavy burgundy siege automaton with broad armored shoulders and two stout articulated legs, facing lower-right; (2) slender plum-colored ranged robot with an integrated energy rifle and luminous magenta power pack, facing lower-right; (3) huge imposing rusty copper boss mech, thick layered armor, large forearms, glowing amber furnace chest, sturdy legs, facing lower-right; (4) steel-blue armored knight robot, tall broad shield, ivory armor accents, facing lower-right.
Row 4: (1) lean vivid orange berserker robot with two curved bladed forearms, dynamic legs, facing lower-right; (2) sage-green support medic robot with cream backpack, cyan healing canister, small luminous plus marking, facing lower-right; (3) one natural irregular gray boulder with layered weathering, crevices, moss and tiny ferns at foot; (4) a different low rugged moss-covered boulder with fractured faces and small lichen patches.
All sixteen cells contain exactly one complete sprite, no additional objects in cell margins. Buildings fill about 75 percent cell width and 75 percent height. Enemy robots fill about 65 percent cell width and 78 percent height; their feet stay completely visible. Rocks fill about 75 percent width and 55 percent height. The sheet must retain a transparent alpha background.
