/*

Vector Schematic Renderer

Copyright (c) 2023 esophagoose, Graham Sutherland

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

RENDER_ORDER = {
	'AltiumHarness': 0,
	'AltiumSheetSymbol': 0,
	'AltiumRectangle': 0
}

class AltiumSchematicRenderer
{
	constructor(render_area, document)
	{
		this.render_area = render_area;
		this.document = document;
		this.parameters = [];
		this.schematic = null;
	}
	
	#shouldShow(object)
	{
		if (object.hidden ?? false) 
			return false;
		 
		if ((object.owner_part_id == null || object.owner_part_id < 1) && object.owner_display_mode == -1)
			return true;
		
		const parent = object.findParent(AltiumComponent);
		if (parent == null)
			return true;
		
		if ((parent.current_part_id == null || parent.current_part_id < 1) && parent.display_mode < 1)
			return true;
		
		if (parent.current_part_id == null || parent.current_part_id < 1)
			return parent.display_mode == object.owner_display_mode;

		if (parent.display_mode < 1 && object.owner_display_mode === undefined)
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

	generate_svg_arc(x, y, radius, startAngle, endAngle) {
		function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
			var angleInRadians = (angleInDegrees-90) * Math.PI / 180.0;
		
			return {
			x: centerX + (radius * Math.cos(angleInRadians)),
			y: centerY + (radius * Math.sin(angleInRadians))
			};
		}
	  
		  var start = polarToCartesian(x, y, radius, endAngle);
		  var end = polarToCartesian(x, y, radius, startAngle);
	  
		  var largeArcFlag = 1 //endAngle - startAngle <= 180 ? "0" : "1";
	  
		  var d = [
			  "M", start.x, start.y, 
			  "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
		  ].join(" ");
	  
		  return d;       
	  }

	convertPoints(points)
	{
		return points.reduce((acc, pt) => {
			acc.push([pt.x, pt.y]);
			return acc
		}, []);
	}

	text(base, obj, text="", color="", alignment="")
	{
		const align = ["start", "middle", "end"][obj.justification % 3];
		const font = this.document.sheet.fonts[obj.font_id ?? 1];
		const _text = !text ? obj.text : text;
		const _color = !color ? obj.color : color;
		const _align = !alignment ? align : alignment;
		const _angle = -obj.orientation * 90 - 180;
		const _baseline = obj.baseline ?? "auto";
		const _flip = _angle > -270 ? "x" : "y";

		// Apply font first so the text sizing is correct before the transform
		var tgroup = base.group().addClass(`text-${obj.record_index}`)
		var text_svg = tgroup.text(_text).font({ 
			fill: _color,
			family: font.name,
			style: font.italic ? "italic " : "normal",
			weight: font.bold ? "bold " : "normal",
			size: font.size - 1,
		});

		// Move and then apply alignment
		tgroup.move(obj.x, obj.y)
		text_svg.font({anchor: _align}).transform({
			rotate: _angle,
			flip: _flip
		}); // .attr({"dominant-baseline": _baseline})
		obj.svg = text_svg;
	}

	multilineText(base, obj, width, height)
	{
		const align = ["left", "middle", "right"][obj.justification ?? 0 % 3];
		const font = this.document.sheet.fonts[obj.font_id ?? 1];
		const color = obj.color ?? "black";
		let font_style = `text-align:${align};font-family:${font.name};font-size:${font.size-1}px`;
		let style = `color:${color};transform:scale(1,-1);${font_style}`;
		let content = `<p style="${style}">${obj.text}</p>`;

		base.foreignObject(width, height).add(content).move(obj.x, obj.y);
	}

	get_order(obj)
	{
		return RENDER_ORDER[obj.constructor.name] ?? 1
	}

	render()
	{
		let area = this.render_area;
		let doc = this.document;
		
		let sheet = doc.objects.find((o) => o instanceof AltiumSheet);
		let scale = Math.min(area.height / sheet.height, area.width / sheet.width);
		var frame = area.group().transform({scale: scale});
		let background = frame.rect(sheet.width, sheet.height).fill(sheet.areacolor)
		if (true) {
			let style = {color: "black", width: 1};
			background.stroke(style);

			frame.rect(sheet.width-40, sheet.height-40).move(20, 20).fill('none').stroke(style);
		}
		// Save sheet variables
		let parameters = altiumDocument.objects.filter((o) => o instanceof AltiumParameter);
		this.parameters = parameters.filter((o) => o.parent_object == null)
		this.parameters.forEach((o) => o.name = o.name.toLowerCase())
		var schematic = frame.group();
		schematic.transform({
			translateY: sheet.height,
			flip: "y"
		});

		for (let obj of doc.objects.sort((a, b) => this.get_order(a) - this.get_order(b)))
		{
			if (!this.#shouldShow(obj)) continue;

			if (obj instanceof AltiumWire || obj instanceof AltiumBus) 
			{
				let style = {
					color: obj.color,
					width: obj.width
				}
				const points = this.convertPoints(obj.points);
				schematic.polyline(points).fill('none').stroke(style)
			}

			else if (obj instanceof AltiumRectangle || obj instanceof AltiumRoundedRectangle)
			{
				obj.svg = schematic.rect(obj.right - obj.left, obj.top - obj.bottom)
				const c = (!obj.transparent) ? obj.fill_color : '#ffffdb';
				if (obj instanceof AltiumRoundedRectangle)
					obj.svg.attr({rx: `${obj.rx}px`, ry: `${obj.ry}px`})
				obj.svg.fill(c).stroke(obj.line_color)
				obj.svg.move(obj.left, obj.bottom)
			}
		
			else if (obj instanceof AltiumTextFrame)
			{
				let width = obj.right - obj.left;
				let height = obj.top - obj.bottom;
				obj.x = obj.left;
				obj.y = obj.bottom;
				const fill = (!obj.transparent) ? obj.fill_color : 'none';
				const stroke = (obj.show_border) ? obj.border_color : 'none';
				var rect = schematic.rect(width, height).fill(fill).stroke(stroke);
				rect.move(obj.left, obj.bottom)
				this.multilineText(schematic, obj, width, height)
			}

			else if (obj instanceof AltiumEllipse)
			{
				const parsed_fill_color = obj.fill_color;
				const fill_color = (!obj.transparent) ? parsed_fill_color : 'none';
				var circle = schematic.ellipse(0, 0).radius(obj.radius_x, obj.radius_y);
				circle.move(obj.x-obj.radius_x, obj.y-obj.radius_y);
				circle.fill(fill_color).stroke(obj.line_color)
			}

			else if (obj instanceof AltiumPort)
			{
				const style = {
					color: obj.border_color,
					width: 1
				}
				const y = obj.y - (obj.height) / 2;
				const points = this.makePort(obj.iotype, obj.x, y, obj.width, obj.height);
				schematic.polyline(points).fill(obj.fill_color).stroke(style)

				// Modifying object to stylize text
				obj.x += 5;
				obj.y -= obj.height / 2;
				this.text(schematic, obj, obj.text);
			}

			else if (obj instanceof AltiumNoERC)
			{
				const style = {
					color: obj.color,
					width: 0.5
				}

				schematic.line(obj.x+5, obj.y+5, obj.x-5, obj.y-5).stroke(style)
				schematic.line(obj.x-5, obj.y+5, obj.x+5, obj.y-5).stroke(style)
			}

			else if (obj instanceof AltiumPin)
			{
				const x = obj.x + obj.angle_vec[0] * obj.length
				const y = obj.y + obj.angle_vec[1] * obj.length
				schematic.line(obj.x, obj.y, x, y).stroke({ width: 1, color: "black" }).addClass(`pin-${obj.record_index}`)

				if (!obj.show_name)
					continue;
					
				obj.font_id = 1;
				obj.justification = (obj.orientation == 1 || obj.orientation == 2) ? 2 : 0;

				// Add padding
				if (obj.orientation % 2 == 0) {
					obj.x -= (obj.orientation - 1) * 3
				} else {
					obj.y -= (obj.orientation - 1) * 3
				}
				this.text(schematic, obj, obj.designator);
				obj.justification = (obj.orientation == 1 || obj.orientation == 2) ? 0 : 2;
				obj.y -= (doc.sheet.fonts[obj.font_id].size / 2) - 1;
				// Add padding
				if (obj.orientation % 2 == 0) {
					obj.x += (obj.orientation - 1) * 6
				} else {
					obj.y += (obj.orientation - 1) * 6
				}
				this.text(schematic, obj, obj.name);
			}

			else if (obj instanceof AltiumLine)
			{
				var line = schematic.line(obj.x1, obj.y1, obj.x2, obj.y2)
				line.stroke({ width: 1, color: obj.color })
				line.addClass(`record-${obj.record_index}`)
				obj.svg = line;
			}
			else if (obj instanceof AltiumBusEntry)
			{
				var line = schematic.line(obj.x1, obj.y2, obj.x2, obj.y1)
				line.stroke({ width: 1, color: obj.color })
			}

			else if (obj instanceof AltiumArc || obj instanceof AltiumEllipticalArc)
			{
				obj.secondary_radius = obj.secondary_radius ?? obj.radius;
				obj.end_angle += 0.0001;
				let angle1 = (obj.start_angle-180) * Math.PI / 180.0;
				let angle2 = (obj.end_angle-180) * Math.PI / 180.0;
				let x1 = obj.x + (obj.radius * Math.cos(angle1));
				let y1 =  obj.y + (obj.secondary_radius * Math.sin(angle1));
				let x2 = obj.x + (obj.radius * Math.cos(angle2));
				let y2 =  obj.y + (obj.secondary_radius * Math.sin(angle2));
				let arcFlag = obj.end_angle - obj.start_angle <= 180 ? 0 : 1;
				const path = `M ${x1} ${y1} A ${obj.radius}, ` +
					`${obj.secondary_radius}, 0, ${arcFlag}, 0, ${x2}, ${y2}`
				schematic.path(path).fill('none')
					.stroke({ width: obj.width, color: obj.color })
			}

			else if (obj instanceof AltiumPolyline)
			{
				const color = obj.color;
				const fill_color = obj.color;
				let style = {color: color, width: obj.width}
				schematic.polyline(obj.points).fill('none').stroke(style).addClass(`record-${obj.record_index}`)
				
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

			else if (obj instanceof AltiumPolygon)
			{
				const fill = obj.fill_color;
				const points = obj.points.reduce(
					(string, pt) => string + `${pt.x},${pt.y} `, ""
				);
				let style = {
					color: obj.line_color,
					width: obj.width
				}
				schematic.polyline(points).fill(fill).stroke(style)
			}

				else if (obj instanceof AltiumJunction)
			{

				
				const color = obj.color;
				schematic.ellipse(3, 3).fill(color).move(obj.x-1.5, obj.y-1.5)
			}
		
			else if (obj instanceof AltiumSheetSymbol)
			{
				const fill = obj.fill_color;
				const stroke = obj.line_color;
				var rect = schematic.rect(obj.width, obj.height).move(obj.x, obj.y - obj.height)
				rect.fill(fill).stroke(stroke)
			}
		
			else if (obj instanceof AltiumSheetEntry)
			{
				if (obj.type != "Block & Triangle") {
					console.warn(`Unknown sheet entry type: ${obj.type}`)
					continue;
				}

				const fill = obj.fill_color;
				const stroke = obj.color;
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

			else if (obj instanceof AltiumPowerPort)
			{
				const style = { width: 1, color: obj.color}
				if (!obj.is_off_sheet_connector)
				{
					switch (obj.style_name)
					{
						case "DEFAULT":
							schematic.line(obj.x, obj.y, obj.x, obj.y + 5).stroke(style)
							schematic.circle(6).fill('none').stroke(style).move(obj.x - 3, obj.y + 5)
							break
						case "BAR":
							schematic.line(obj.x, obj.y, obj.x, obj.y + 10).stroke(style)
							schematic.line(obj.x - 5, obj.y + 10, obj.x + 5, obj.y + 10).stroke(style)
							break;
						case "POWER_GND":
							schematic.line(obj.x, obj.y, obj.x, obj.y - 5).stroke(style)
							schematic.line(obj.x - 11, obj.y - 5, obj.x + 11, obj.y - 5).stroke(style)
							schematic.line(obj.x - 8, obj.y - 8, obj.x + 8, obj.y - 8).stroke(style)
							schematic.line(obj.x - 5, obj.y - 11, obj.x + 5, obj.y - 11).stroke(style)
							schematic.line(obj.x - 2, obj.y - 14, obj.x + 2, obj.y - 14).stroke(style)
							obj.y -= 14;
							break;
						case "SIGNAL_GND":
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
						case "EARTH":
							schematic.line(obj.x, obj.y, obj.x, obj.y - 5).stroke(style)
							schematic.line(obj.x - 5, obj.y - 5, obj.x + 5, obj.y - 5).stroke(style)

							for (let g = -1; g < 2; g++)
								schematic.line(obj.x + (g * 5), obj.y - 5, obj.x + (g * 5) - 3, obj.y - 10).stroke(style)
							break;
						default:
							console.warn("AltiumPowerPort: Unknown symbol type!")
							schematic.rect(20, (obj.orientation == 1) ? 10 : -10).fill(style).move(obj.x - 10, obj.y);
							break;
					}
					if (obj.show_text)
					{
						const font = this.document.sheet.fonts[obj.font_id ?? 1];
						const scalar = (obj.orientation == 2) ? -1 : 1;
						obj.y += scalar * (font.size + 2);
						this.text(schematic, obj);
					}
				}
				else
				{
					console.warn("Off-sheet connector not implemented!")
				}
			}
		
			else if (obj instanceof AltiumSheetFilename || obj instanceof AltiumSheetName || obj instanceof AltiumLabel || obj instanceof AltiumNetLabel)
			{
				if ((obj.text ?? "").startsWith('='))
				{
					let text = obj.text.slice(1).toLowerCase();
					let param = this.parameters.find(x => x.name == text);
					if (param !== undefined)
						obj.text = param.text;
				}
				this.text(schematic, obj);
			}

			else if (obj instanceof AltiumDesignator)
			{
				this.text(schematic, obj, obj.full_designator);
			}
		

			else if (obj instanceof AltiumParameter)
			{
				if (obj.hidden || obj.is_implementation_parameter)
					continue;
				if (obj.text.startsWith("=")) {
					let key = obj.text.slice(1);
					let parameter = doc.objects.find(x => (x.owner_record_index == obj.owner_record_index && (x.name ?? "").toLowerCase() == key.toLowerCase()));
					obj.text = parameter.text;
				}
				this.text(schematic, obj)
			}
			else if (obj instanceof AltiumImage)
			{
				let width = obj.corner_x - obj.x;
				let height = obj.corner_y - obj.y;
				schematic.image(obj.filename).move(obj.x, obj.y)
					.size(width, height).transform({flip: "y"})
			}
			else if (obj instanceof AltiumHarness)
			{
				const pad = obj.side == 0 ? 5 : -5; 
				schematic.rect(obj.width - Math.abs(pad), obj.height).fill(obj.areacolor)
					.move(obj.x + (obj.side == 0 ? 5 : 0), obj.y - obj.height);
				const style = { width: obj.linewidth, color: obj.color };
				const points = [
					[obj.x + 2*pad, obj.y],
					[obj.x + pad, obj.y],
					[obj.x + pad, obj.y - obj.position + 5],
					[obj.x, obj.y - obj.position],
					[obj.x + pad, obj.y - obj.position - 5],
					[obj.x + pad, obj.y - obj.height],
					[obj.x + 2*pad, obj.y - obj.height]
				];
				if (obj.side == 1) {
					for (let i = 0; i < points.length; i++) {
						points[i][0] += obj.width;
					}
				}
				schematic.polyline(points).fill(obj.areacolor).stroke(style);
			}
			else if (obj instanceof AltiumHarnessPin)
			{
				const r = 3;
				const font = this.document.sheet.fonts[obj.font_id ?? 1];
				let text_pad = 3;
				obj.x = obj.parent.x - (r / 2);
				if (obj.side == 1) {
					obj.x += obj.parent.width;
					obj.justification = 2;
					text_pad *= -1;
				}
				obj.y =  obj.parent.y - obj.from_top - (r / 2);
				schematic.circle(r).fill(obj.color).move(obj.x, obj.y)
				obj.x += text_pad;
				obj.y -= font.size / 2 - 1;
				this.text(schematic, obj, obj.name, obj.textcolor)
			}
			else if (obj instanceof AltiumHarnessWire)
			{
				let style = {color: obj.parent.areacolor, width: obj.width * 2, linecap: 'butt' };
				const points = this.convertPoints(obj.points);
				schematic.polyline(points).fill('none').stroke(style);
				style = {color: obj.color, width: obj.width / 2, linecap: 'round' };
				schematic.polyline(points).fill('none').stroke(style);
			}
			else if (obj instanceof AltiumHarnessLabel)
			{
				this.text(schematic, obj);
			}
			else if (obj instanceof AltiumImplementation || obj instanceof AltiumImplementationParameterList
				 || obj instanceof AltiumImplementationPinAssociation || obj instanceof AltiumImplementationList
				 || obj instanceof AltiumComponent || obj instanceof AltiumSheet || obj instanceof AltiumTemplateFile) {}
			else
			{
				if (obj.attributes_raw.length == 0) {
					console.warn("Found empty record ...")
					continue
				}
				console.warn(`Unhandled object: ${obj.constructor.name} ${obj.attributes["record"]}`)
			}
		}
		this.schematic = schematic;
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



	crossOutRefDes(refdes)
	{
		let results = this.document.objects.filter(x => {
			return x instanceof AltiumDesignator && x.text == refdes
		});
		if (results.length === 0)
			return
		let component = results[0].parent_object;
		var min_x = 9999;
		var max_x = 0;
		var min_y = 9999;
		var max_y = 0;
		component.child_objects.filter(x => x instanceof AltiumRectangle).forEach(r => {
			r.svg.fill("#eee").stroke("#aaa");
			min_x = Math.min(min_x, r.left, r.right);
			max_x = Math.max(max_x, r.left, r.right);
			min_y = Math.min(min_y, r.top, r.bottom);
			max_y = Math.max(max_y, r.top, r.bottom);
		})
		component.child_objects.filter(x => x instanceof AltiumLine).forEach(r => {
			r.svg.stroke("#aaa");
			min_x = Math.min(min_x, r.x1, r.x2);
			max_x = Math.max(max_x, r.x1, r.x2);
			min_y = Math.min(min_y, r.y1, r.y2);
			max_y = Math.max(max_y, r.y1, r.y2);
		})
		component.child_objects.filter(x => (x instanceof AltiumParameter || x instanceof AltiumDesignator) && x.svg).forEach(r => {
			r.svg.font({fill: "#aaa"})
		})

		if (min_x == 9999 || min_y == 9999)
			return
		let style = { width: 4, color: "red", linecap: "round"}
		this.schematic.line(min_x, min_y, max_x, max_y).stroke(style)
		this.schematic.line(max_x, min_y, min_x, max_y).stroke(style)
	}

	handleVariation(variation)
	{

	}
}
