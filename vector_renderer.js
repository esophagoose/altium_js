/*

Vector Schematic Renderer

Copyright (c) 2022 Graham Sutherland, esophagoose

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/


class AltiumSchematicRenderer
{
	constructor(render_area, document)
	{
		this.render_area = render_area;
		this.document = document;
	}
	
	#altiumColourToHex(colourInt)
	{
		return "#" + (colourInt & 0xFF).toString(16).padStart(2, '0') + ((colourInt >> 8) & 0xFF).toString(16).padStart(2, '0') + ((colourInt >> 16) & 0xFF).toString(16).padStart(2, '0');
	}
	
	#shouldShow(object)
	{
		if ((object.owner_part_id == null || object.owner_part_id < 1) && object.owner_display_mode == -1)
			return true;
		
		const parent = object.find_parent(AltiumComponent);
		if (parent == null)
			return true;
		
		if ((parent.current_part_id == null || parent.current_part_id < 1) && parent.display_mode < 1)
			return true;
		
		if (parent.current_part_id == null || parent.current_part_id < 1)
			return parent.display_mode == object.owner_display_mode;

		if (parent.display_mode < 1 || object.owner_display_mode === undefined)
			return parent.current_part_id == object.owner_part_id;
		
		return parent.display_mode == object.owner_display_mode && parent.current_part_id == object.owner_part_id
	}

	makePort(iotype, x, y, width, height)
	{
		const nub = 5;
		switch (iotype) {
			case 0: // Undefined
				return [
					[x, y],
					[x, y + height],
					[x + width, y + height],
					[x + width, y],
					[x, y]
				]
			case 1: // Output
				return [
					[x, y + (height / 2)],
					[(x + nub), y],
					[x + width, y],
					[x + width, y + height],
					[x + nub, y + height],
					[x, y + (height / 2)]
				]
			case 2: // Input
				return [
					[x, y],
					[(x + width - nub), y],
					[x + width, y + (height / 2)],
					[x + width - nub, y + height],
					[x, y + height],
					[x, y]
				]
			case 3: // Bidirectional
				return [
					[x, y + (height / 2)],
					[x + nub, y],
					[x + width - nub, y],
					[x + width, y + (height / 2)],
					[x + width - nub, y + height],
					[x + nub, y + height],
					[x, y + (height / 2)]
				]
			
		}
	}

	text(base, obj, text="", color="", alignment="")
	{
		const align = ["start", "middle", "end"][obj.justification];
		const font = this.document.sheet.fonts[obj.font_id ?? 1];
		const _text = !text ? obj.text : text;
		const _color = !color ? obj.colour : color;
		const _align = !alignment ? align : alignment;
		const _angle = -obj.orientation * 90 - 180;
		const _flip = _angle > -270 ? "x" : "y";

		// Apply font first so the text sizing is correct before the transform
		var text_svg = base.text(_text).font({ 
			fill: this.#altiumColourToHex(_color),
			family: font.name,
			style: font.italic ? "italic " : "normal",
			weight: font.bold ? "bold " : "normal",
			size: font.size - 1
		})
		// Move and then apply alignment
		text_svg.move(obj.x, obj.y).font({anchor: _align});
		text_svg.transform({rotate: _angle, origin: (obj.x, obj.y+font.size/2), flip: _flip})
		
	}

	render()
	{
		let area = this.render_area;
		let doc = this.document;
		
		let sheetObject = doc.objects.find(o => o instanceof AltiumSheet);
		
		let areaColourInt = Number.parseInt(sheetObject.attributes.areacolor, 10);
		let areaColour = this.#altiumColourToHex(areaColourInt);
		area.node.style.backgroundColor = "#aaaaaa";
		let sheet = doc.objects.find((o) => o instanceof AltiumSheet);
		let scale = Math.min(area.height / sheet.height, area.width / sheet.width);
		var frame = area.group().transform({scale: scale});
		frame.rect(sheet.width, sheet.height).fill(areaColour)
		var schematic = frame.group();
		schematic.transform({
			translateY: sheet.height,
			flip: "y"
		});

		for (let obj of doc.objects.filter((o) => o instanceof AltiumWire))
		{
			if (!this.#shouldShow(obj)) continue;

			const points = obj.points.reduce((acc, pt) => {
				acc.push([pt.x, pt.y]);
				return acc
			}, []);
			let style = {
				color: this.#altiumColourToHex(obj.colour),
				width: obj.width
			}
			schematic.polyline(points).fill('none').stroke(style)

		}

		for (let obj of doc.objects.filter((o) => o instanceof AltiumBus))
		{
			if (!this.#shouldShow(obj)) continue;

			const points = obj.points.reduce((acc, pt) => {
				acc.push([pt.x, pt.y]);
				return acc
			}, []);

			let style = {
				color: this.#altiumColourToHex(obj.colour),
				width: 3 * obj.line_width
			}
			schematic.polyline(points).fill('none').stroke(style)

		}

		for (let obj of doc.objects.filter((o) => o instanceof AltiumRectangle))
		{
			if (!this.#shouldShow(obj)) continue;
			
			var rect = schematic.rect(obj.right - obj.left, obj.top - obj.bottom)
			const c = (!obj.transparent) ? this.#altiumColourToHex(obj.fill_colour) : 'none';
			rect.fill(c).stroke(this.#altiumColourToHex(obj.line_colour))
			rect.move(obj.left, obj.bottom)
		}
		
		for (let obj of doc.objects.filter((o) => o instanceof AltiumTextFrame))
		{
			if (!this.#shouldShow(obj)) continue;
			console.warn("Skipped AltiumTextFrame")
			continue
			
			if (!obj.transparent)
			{
				ctx.fillStyle = this.#altiumColourToHex(obj.fill_colour);
				ctx.fillRect(obj.left, obj.top, obj.right - obj.left, obj.bottom - obj.top);
			}
			if (obj.show_border)
			{
				ctx.strokeStyle = this.#altiumColourToHex(obj.border_colour);
				ctx.strokeRect(obj.left, obj.top, obj.right - obj.left, obj.bottom - obj.top);
			}
		}

		for (let obj of doc.objects.filter((o) => o instanceof AltiumEllipse))
		{
			if (!this.#shouldShow(obj)) continue;
			
			const parsed_fill_color = this.#altiumColourToHex(obj.fill_colour);
			const fill_color = (!obj.transparent) ? parsed_fill_color : 'none';
			var circle = schematic.ellipse(0, 0).radius(obj.radius_x, obj.radius_y).move(obj.x, obj.y);
			circle.fill(fill_color).stroke(this.#altiumColourToHex(obj.line_colour))
		}

		for (let obj of doc.objects.filter((o) => o instanceof AltiumPort))
		{
			if (!this.#shouldShow(obj)) continue;
			
			const fill = this.#altiumColourToHex(obj.fill_colour);
			const style = {
				color: this.#altiumColourToHex(obj.border_colour),
				width: 1
			}
			const y = obj.y - (obj.height) / 2;
			const points = this.makePort(obj.iotype, obj.x, y, obj.width, obj.height);
			schematic.polyline(points).fill(fill).stroke(style)

			// Modifying object to stylize text
			obj.x += 5;
			obj.y -= obj.height / 2;
			this.text(schematic, obj, obj.text);
		}

		for (let obj of doc.objects.filter((o) => o instanceof AltiumNoERC))
		{
			if (!this.#shouldShow(obj)) continue;
			
			const style = {
				color: this.#altiumColourToHex(obj.colour),
				width: 0.5
			}

			schematic.line(obj.x+5, obj.y+5, obj.x-5, obj.y-5).stroke(style)
			schematic.line(obj.x-5, obj.y+5, obj.x+5, obj.y-5).stroke(style)
		}

		for (let obj of doc.objects.filter((o) => o instanceof AltiumPin))
		{
			if (!this.#shouldShow(obj)) continue;
			
			const x = obj.x + obj.angle_vec[0] * obj.length
			const y = obj.y + obj.angle_vec[1] * obj.length
			schematic.line(obj.x, obj.y, x, y).stroke({ width: 1, color: "black" })

			if (!obj.show_name)
				continue;
				
			obj.font_id = 1;
			obj.y -= (doc.sheet.fonts[obj.font_id].size / 2) - 1;
			obj.justification = (obj.orientation == 1 || obj.orientation == 2) ? 0 : 2;

			// Add padding
			if (obj.orientation % 2 == 0) {
				obj.x += (obj.orientation - 1) * 3
			} else {
				obj.y += (obj.orientation - 1) * 3
			}
			this.text(schematic, obj, obj.name);
		}

		for (let obj of doc.objects.filter((o) => o instanceof AltiumLine))
		{
			if (!this.#shouldShow(obj)) continue;
			
			var line = schematic.line(obj.x1, obj.y1, obj.x2, obj.y2)
			line.stroke({ width: 1, color: this.#altiumColourToHex(obj.colour) })
		}

		for (let obj of doc.objects.filter((o) => o instanceof AltiumArc))
		{
			if (!this.#shouldShow(obj)) continue;
			
			console.warn("Skipping AltiumArc")
			continue
			ctx.strokeStyle = this.#altiumColourToHex(obj.colour);
			ctx.lineWidth = obj.width;
			ctx.beginPath();
			ctx.arc(obj.x, obj.y, obj.radius, obj.start_angle * Math.PI/180, obj.end_angle * Math.PI/180);
			ctx.stroke();
			ctx.lineWidth = 1;
		}

		for (let obj of doc.objects.filter((o) => o instanceof AltiumPolyline))
		{
			if (!this.#shouldShow(obj)) continue;
			
			const color = this.#altiumColourToHex(obj.colour);
			const fill_color = this.#altiumColourToHex(obj.colour);
			
			// switch (obj.line_style)
			// {
			// 	case 1:
			// 		ctx.setLineDash([4, 4]);
			// 		break;
			// 	case 2:
			// 		ctx.setLineDash([2, 2]);
			// 		break;
			// 	case 3:
			// 		ctx.setLineDash([4, 2, 2, 4]);
			// 		break;
			// }
			

			const points = obj.points.reduce(
				(string, pt) => string + `${pt.x},${pt.y} `, ""
			);
			let style = {color: color, width: obj.width}
			schematic.polyline(points).fill('none').stroke(style)
			
			let shapeSize = obj.shape_size + 1;
			if (obj.start_shape > 0)
			{
				let pa = obj.points[1];
				let pb = obj.points[0];
				let dx = pb.x - pa.x;
				let dy = pb.y - pa.y;
				let angle = Math.atan2(dy, dx);
				const baseSize = 3 + shapeSize;
				let tax = pb.x - Math.cos(angle - Math.PI/6) * baseSize;
				let tay = pb.y - Math.sin(angle - Math.PI/6) * baseSize;
				let tbx = pb.x - Math.cos(angle + Math.PI/6) * baseSize;
				let tby = pb.y - Math.sin(angle + Math.PI/6) * baseSize;

				let pts = ""
				pts += `${tax},${tay}`;
				pts += `${pb.x + Math.cos(angle) * 0.5},${pb.y + Math.sin(angle) * 0.5}`;
				pts += `${tbx},${tby}`;
				var polyline = schematic.polyline(pts).stroke(style)

				if (obj.start_shape == 2 || obj.start_shape == 4)
					polyline.fill(fill_color);
			}
			if (obj.end_shape > 0)
			{
				let pa = obj.points[obj.points.length - 2];
				let pb = obj.points[obj.points.length - 1];
				let dx = pb.x - pa.x;
				let dy = pb.y - pa.y;
				let angle = Math.atan2(dy, dx);
				const baseSize = 3 + shapeSize;
				let tax = pb.x - Math.cos(angle - Math.PI/6) * baseSize;
				let tay = pb.y - Math.sin(angle - Math.PI/6) * baseSize;
				let tbx = pb.x - Math.cos(angle + Math.PI/6) * baseSize;
				let tby = pb.y - Math.sin(angle + Math.PI/6) * baseSize;

				let pts = ""
				pts += `${tax},${tay}`;
				pts += `${pb.x + Math.cos(angle) * 0.5},${pb.y + Math.sin(angle) * 0.5}`;
				pts += `${tbx},${tby}`;
				var polyline = schematic.polyline(pts).stroke(style)

				if (obj.start_shape == 2 || obj.start_shape == 4)
					polyline.fill(fill_color);
			}
		}

		for (let obj of doc.objects.filter((o) => o instanceof AltiumPolygon))
		{
			if (!this.#shouldShow(obj)) continue;
			
			const fill = this.#altiumColourToHex(obj.fill_colour);
			const points = obj.points.reduce(
				(string, pt) => string + `${pt.x},${pt.y} `, ""
			);
			let style = {
				color: this.#altiumColourToHex(obj.line_colour),
				width: obj.width
			}
			schematic.polyline(points).fill(fill).stroke(style)
		}

		for (let obj of doc.objects.filter((o) => o instanceof AltiumJunction))
		{
			if (!this.#shouldShow(obj)) continue;
			
			const color = this.#altiumColourToHex(obj.colour);
			schematic.ellipse(3, 3).fill(color).move(obj.x-1.5, obj.y-1.5)
		}
		
		for (let obj of doc.objects.filter((o) => o instanceof AltiumSheetSymbol))
		{
			const fill = this.#altiumColourToHex(obj.fill_colour);
			const stroke = this.#altiumColourToHex(obj.line_colour);
			var rect = schematic.rect(obj.width, obj.height).move(obj.x, obj.y - obj.height)
			rect.fill(fill).stroke(stroke)
		}
		
		for (let obj of doc.objects.filter((o) => o instanceof AltiumSheetEntry))
		{
			if (obj.type != "Block & Triangle") {
				console.warn(`Unknown sheet entry type: ${obj.type}`)
				continue;
			}

			const fill = this.#altiumColourToHex(obj.fill_colour);
			const stroke = this.#altiumColourToHex(obj.colour);
			const height = 7.5;
			const width = 15;
			const nub = 5;
			const x = obj.parent_object.x;
			const y = obj.parent_object.y - obj.from_top - (height/2);
			const angle = [0, 180, 90, 270][obj.side];
			let p = this.makePort(obj.iotype, x, y, width, height);
			var entry = schematic.polyline(p).move(x, y).fill(fill).stroke(stroke)
			const ox = x + (obj.parent_object.width / 2)
			entry.transform({ rotate: angle, originX: {x: ox, y: y + (height/2)}})
			var text_obj = obj;
			text_obj.orientation = angle / 90;
			text_obj.justification = [0, 2, 2, 0][obj.side];
			text_obj.x = obj.parent_object.x + width + nub;
			if (text_obj.side == 1)
				text_obj.x += obj.parent_object.width - 2*(width + nub);
			text_obj.y = y;
			this.text(schematic, text_obj, text_obj.name)
		}

		for (let obj of doc.objects.filter((o) => o instanceof AltiumPowerPort))
		{
			if (!this.#shouldShow(obj)) continue;
			
			const style = { width: 1, color: this.#altiumColourToHex(obj.colour)}
			if (!obj.is_off_sheet_connector)
			{
				switch (obj.style)
				{
					case 0:
						schematic.line(obj.x, obj.y, obj.x, obj.y + 5).stroke(style)
						schematic.circle(6).fill('none').stroke(style).move(obj.x - 3, obj.y + 5)
						break
					case 2:
						schematic.line(obj.x, obj.y, obj.x, obj.y + 10).stroke(style)
						schematic.line(obj.x - 5, obj.y + 10, obj.x + 5, obj.y + 10).stroke(style)
						break;
					case 4:
						schematic.line(obj.x - 10, obj.y, obj.x + 10, obj.y).stroke(style)
						schematic.line(obj.x - 7.5, obj.y - 2, obj.x + 7.5, obj.y - 2).stroke(style)
						schematic.line(obj.x - 5, obj.y - 4, obj.x + 5, obj.y - 4).stroke(style)
						schematic.line(obj.x - 2.5, obj.y - 6, obj.x + 2.5, obj.y - 6).stroke(style)
						break;
					case 5:
						let pts = [
							[obj.x, obj.y],
							[obj.x, obj.y - 5],
							[obj.x - 10, obj.y - 5],
							[obj.x, obj.y - 15],
							[obj.x + 10, obj.y - 5],
							[obj.x, obj.y - 5]
						]

						schematic.polyline(pts).fill('none').stroke(style);
						break;
					case 6:
						schematic.line(obj.x, obj.y, obj.x, obj.y - 5).stroke(style)
						schematic.line(obj.x - 5, obj.y - 5, obj.x + 5, obj.y - 5).stroke(style)

						for (let g = -1; g < 2; g++)
						{
							schematic.line(obj.x + (g * 5), obj.y - 5, obj.x + (g * 5) - 3, obj.y - 10).stroke(style)
						}
						break;
					default:
						schematic.rect(20, (obj.orientation == 1) ? 10 : -10).fill(style).move(obj.x - 10, obj.y);
						break;
				}
			}
			else
			{
				console.warn("Off-sheet connector not implemented!")
			}
		}
		
		for (let obj of doc.objects.filter((o) => o instanceof AltiumSheetFilename))
		{
			if (!this.#shouldShow(obj)) continue;
			this.text(schematic, obj);
		}

		for (let obj of doc.objects.filter((o) => o instanceof AltiumLabel))
		{
			if (!this.#shouldShow(obj) || obj.hidden) continue;
			this.text(schematic, obj)
		}

		for (let obj of doc.objects.filter((o) => o instanceof AltiumDesignator))
		{
			if (!this.#shouldShow(obj) || obj.hidden) continue;
			this.text(schematic, obj, obj.full_designator);
		}
		

		for (let obj of doc.objects.filter((o) => o instanceof AltiumParameter))
		{
			if (!this.#shouldShow(obj)) continue;
			
			if (obj.hidden || obj.is_implementation_parameter)
				continue;
			
			const align = ["start", "start", "end", "end"][obj.justification];
			const color  = this.#altiumColourToHex(obj.colour);
			const font = doc.sheet.fonts[obj.font_id];
			const transform = JSON.parse(JSON.stringify(schematic.transform()));
			const baseline = ["hanging", "hanging", "text-top", "text-top"][obj.orientation];
			var text = schematic.text(obj.text).move(obj.x, obj.y)
			text.font({ 
				anchor: align,
				fill: color,
				family: font.name,
				style: font.italic ? "italic " : "normal",
				weight: font.bold ? "bold " : "normal",
				size: font.size - 1
			}).transform({rotate: -obj.orientation * 90 - 180, flip: "x"})
			text.attr("dominant-baseline", baseline)
			schematic.transform(transform)
		}

		for (let obj of doc.objects.filter((o) => o instanceof AltiumNetLabel))
		{
			if (!this.#shouldShow(obj) || obj.hidden) continue;
			this.text(schematic, obj)
		}

		for (let obj of doc.objects.filter((o) => o instanceof AltiumPowerPort))
		{
			if (!this.#shouldShow(obj) || !obj.show_text) continue;
			
			const align = ["start", "middle", "end", "middle"][obj.orientation];
			const color  = this.#altiumColourToHex(obj.colour);
			const transform = JSON.parse(JSON.stringify(schematic.transform()));
			const font = doc.sheet.fonts[1];
			let offset_y = [0, 10, 0, -10][obj.orientation];
			var text = schematic.text(obj.text).move(obj.x, obj.y + offset_y)
			text.font({ 
				anchor: align,
				fill: color,
				family: font.name,
				style: font.italic ? "italic " : "normal",
				weight: font.bold ? "bold " : "normal",
				size: font.size - 1
			}).transform({rotate: 180, flip: "x"})
			schematic.transform(transform)
		}

		for (let obj of doc.objects.filter((o) => o instanceof AltiumTextFrame))
		{
			console.warn("Skipping AltiumTextFrame");
			continue;
			if (!this.#shouldShow(obj)) continue;
			
			if (obj.font_id > 0 && doc.sheet.fonts[obj.font_id] != null)
			{
				const frameFont = doc.sheet.fonts[obj.font_id];
				const fontStr = (frameFont.size - 1).toString() + "px " + frameFont.name;
				if (fontStr.includes(":") || fontStr.includes("/") || !document.fonts.check(fontStr))
				{
					ctx.font = savedFont;
				}
				else
				{
					ctx.font = fontStr;
				}
			}
			
			ctx.fillStyle = this.#altiumColourToHex(obj.text_colour);
			ctx.textAlign = ["center", "left", "right"][obj.alignment];
			let offset_x = [(obj.right-obj.left)/2, obj.text_margin, (obj.right-obj.left) - obj.text_margin][obj.alignment];
			if (!obj.word_wrap)
			{
				ctx.fillText(obj.text.replaceAll("~1", "\n"), obj.left + offset_x, render_area.height - (obj.top + (obj.bottom-obj.top)/2));
			}
			else
			{
				// todo: refactor this so that an initial pass figures out all the line splits, then a second pass writes the text, so that vertical alignment can be supported.
				const text = obj.text.replaceAll("~1", "\n");
				const lines = text.split("\n");
				let ypos = 0;
				if (lines.length > 1)
				{
					// this is a total hack, but if there are multiple lines in the text then we can make a rough guess at how far up we need to shift the text to center it vertically
					// this doesn't correct for line wraps (see todo above for refactoring approach) but it's at least something I guess!
					const roughMeasure = ctx.measureText(text);
					ypos = ((roughMeasure.fontBoundingBoxDescent + roughMeasure.fontBoundingBoxAscent) * -lines.length) / 2;
				}
				const maxWidth = (obj.right - obj.left) + (obj.text_margin * 2);
				for (let line of lines)
				{
					const lineMeasure = ctx.measureText(line);
					if (lineMeasure.width <= maxWidth)
					{
						ctx.fillText(line, obj.left + offset_x, (render_area.height - (obj.top + (obj.bottom-obj.top)/2)) + ypos);
						ypos += lineMeasure.fontBoundingBoxDescent + lineMeasure.fontBoundingBoxAscent;
					}
					else
					{
						let words = line.split(" ");
						while (words.length > 0)
						{
							if (words.length == 1)
							{
								// we only have one word, either because that's just how many we had or because the final word is super long
								const lastWord = words[0];
								const lastWordMeasure = ctx.measureText(lastWord);
								ctx.fillText(lastWord, obj.left + offset_x, (render_area.height - (obj.top + (obj.bottom-obj.top)/2)) + ypos);
								ypos += lastWordMeasure.fontBoundingBoxDescent + lineMeasure.fontBoundingBoxAscent;
								words = [];
								break;
							}
							for (let wc = words.length; wc > 0; wc--)
							{
								const partialLine = words.slice(0, wc - 1).join(" ");
								const partialMeasure = ctx.measureText(partialLine);
								if (partialMeasure.width <= maxWidth || wc == 1)
								{
									ctx.fillText(partialLine, obj.left + offset_x, (render_area.height - (obj.top + (obj.bottom-obj.top)/2)) + ypos);
									ypos += partialMeasure.fontBoundingBoxDescent + lineMeasure.fontBoundingBoxAscent;
									words = words.slice(wc - 1);
									break;
								}
							}
						}
					}
				}
			}
		}
		const tx = (area.width - sheet.width * scale) / 2;
		const ty = (area.height - sheet.height * scale) / 2;
		frame.transform({
			scale: scale,
			originX: 0,
			originY: 0,
			translateX: tx,
			translateY: ty
		}) 
	}
}