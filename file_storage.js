/*

schdoc.js OLE Storage Parser

Copyright (c) 2023 esophagoose

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

class AltiumStorage
{
	static #stringDecoder = new TextDecoder('utf-8');
	static get StringDecoder() { return AltiumStorage.#stringDecoder; }
	
	get string_contents()
	{
		return AltiumStorage.StringDecoder.decode(this.data).slice(0, -1);
	}
	
	read_header()
	{
		this.position = this.stream.u8stream_position;
		this.payload_length = this.stream.read_u16_le();
		this.padding = this.stream.read_u8();
		if (this.padding != 0)
			console.warn(`Padding byte isn't zero in header`);
		this.record_type = this.stream.read_u8();
		if (this.record_type != 0)
			console.warn(`Record type zero in header`);
		this.data = this.stream.read(this.payload_length);
		let header = AltiumStorage.StringDecoder.decode(this.data.slice(0, -1))
		if (!header.includes("|HEADER=Icon storage"))
			new Error(`Invalid header received: ${header}`)
	}
	
	constructor(stream)
	{
		this.stream = stream;
		this.images = {};
		this.read_header()
		
		while (this.stream.u8stream_position + 1 < this.stream.length)
		{
			let image = new AltiumBitmap(this.stream)
			console.log(this.stream.u8stream_position)
			this.images[image.filename] = image
		}
	}
}

class AltiumBitmap
{
	constructor(stream)
	{
		this.stream = stream;
		this.position = this.stream.u8stream_position;
		this.payload_length = this.stream.read_u16_le();
		this.padding = this.stream.read_u8();
		if (this.padding != 0) console.warn(`Padding byte != 0 in image`);
		this.record_type = this.stream.read_u8();
		if (this.record_type != 1) console.warn(`Record type != 0 in image`);
		this.magic_value = this.stream.read_u8();
		if (this.magic_value != 208)
			console.warn(`Magic value != 208 in image: ${this.magic_value}`);
		this.filename_size = this.stream.read_u8();
		this.filename_raw = this.stream.read(this.filename_size);
		this.filename = AltiumStorage.StringDecoder.decode(this.filename_raw)
		this.image_size = this.stream.read_u32_le()
		this.image_raw = this.stream.read(this.image_size)
	}
}