# 炮管素材 v1

内置 image_gen 生成；battlefield-atlas-v1.png 仅用于材质与配色参考。barrels-v1.png 为原始透明图集，三行依次为双管机炮、重型榴弹炮、双管狙击炮。

素材为向右的俯视武器附件。游戏先按世界朝向旋转，再应用等轴地面的纵向压缩；与底座独立渲染，保留后坐力、炮口闪光与建造透明度。材质与碰撞、射程及伤害无关。建造栏和资料库复用同图集。

## 完整生成提示词

Use case: stylized-concept.
Asset type: ONE transparent game weapon attachment atlas, square 1536x1536, exactly THREE horizontal rows of equal height. Each row contains one long horizontal gun assembly. The attached sprite sheet is a palette/material reference only. Do NOT reproduce any turret foundation, robot, rock, base, icons, labels or the sheet layout. Generate ONLY the three detached rotating weapon assemblies.
Rendering: orthographic directly TOP-DOWN, gun axes exactly horizontal, rear receiver on LEFT, muzzles pointing exactly RIGHT. Top faces visible; no isometric projection baked in because the game projects the weapons into isometric view. A high quality hand-painted realistic strategy-game look matching the reference: worn olive and cream armor, machined dark steel, warm brass, detailed bevel highlights, screws, cooling vents, scratches, layered mechanical components. Strong readable metallic forms, cylindrical barrels with rounded highlights. NOT flat vector icons, NOT segmented rectangles, NOT primitive blocks. Symmetric about each weapon's horizontal centerline. No cast shadows on the background, keep actual alpha transparency.
Composition: within each of the three 1536x512 cells the full gun extends approximately from x=180 to x=1370; centered at y=256 within that row. Gun body's overall height about 260 pixels max. Each has a compact armored REAR RECEIVER at x=350, which is the swivel attachment point for a tower. Barrels extend right from this receiver. NO circular turret base, pedestal, stand, legs, ground, ammo scattered outside, separate panels or unexplained extra parts. Leave generous transparent spacing. Nothing crosses a row boundary.
Top row: twin-barrel rapid autocannon. Two parallel dark steel cylindrical barrels with drilled olive cooling jackets, pale brushed steel muzzle collars, a compact rounded cream-and-sage armored receiver at the left, exposed brass feed components tucked into the receiver. Fine steel highlights, small bolts, restrained mint sensor light. Narrow gap between the two distinct barrels.
Middle row: heavy howitzer. One thick stepped cylindrical gun barrel, a substantial dark open muzzle with a short vented muzzle brake at right, a warm brass recoil sleeve, stout olive breech at the left, two slim recoil pistons beside the central tube, scratched cream protective plates. Industrial, mechanically believable, not a tube made of square blocks.
Bottom row: twin long precision sniper guns. Two slender parallel dark gunmetal cylindrical barrels with fine silver ribs, copper mounting hardware, elongated ivory rear receiver at the left, subtle coral sensor, a small inset optic and precision clamps. Distinct narrow silhouette, the longest-looking barrels of the three.
All weapons face RIGHT, all complete and disconnected, no words or watermarks, no perspective floor, transparent background.
