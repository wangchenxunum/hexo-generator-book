const marked = require('marked');

class Renderer extends marked.Renderer {
	constructor() {
		super();
		this._headingId = {};
	}
	// To-Do 列表
	listitem(text) {
		if (/^\s*\[[x ]\]\s*/.test(text)) {
			text = text
				.replace(/^\s*\[ \]\s*/, '<input type="checkbox" disabled></input>')
				.replace(/^\s*\[x\]\s*/, '<input type="checkbox" disabled checked></input> ');
			return `<li style="list-style: none">${text}</li>\n`;
		}
		return `<li>${text}</li>\n`;
	}
	// 支持autolink选项及站内.md自动转.html
	link(href, title, text) {
		if (!this.options.autolink && href === text && title == null) {
			return href;
		}
		if (href.substr(0,2) !== "//") {
			href = href.replace(/^([^\?\#\:]+)\.(?:md)((?:[?#].*)?)$/gi, "$1.html$2")
		}
		return super.link(href, title, text);
	}

	heading(text, level) {
		const title = text.replace(/<\/?[A-Za-z0-9\-\:]+.*?>/g, "").replace(/\s+/g, " ");
		const id = title.replace(/\s+/g, "-");
		const headingId = this._headingId;
		if (headingId[id]) {
			id += '-' + headingId[id]++;
		} else {
			headingId[id] = 1;
		}
		return `<h${level} id="${id}"><a href="#${id}" class="headerlink" title="${title}"></a>${text}</h${level}>`;
	}
	paragraph(text) {
		if (/^<img\s[^>]*>$/.test(text)) {
			return text;
		}
		if (!this.renderTex) {
			return "<p>" + text + "</p>";
		}
		if (/^\$\$([\s\S]*?)\$\$$/.test(text)) {
			return text.replace(/^\$\$([\s\S]*?)\$\$$/g, '<pre><code class="math">$1</code></pre>');
		} else {
			return "<p>" + text.replace(/\$\$([\s\S]*?)\$\$/g, '<code class="math">$1</code>') + "</p>";
		}
	}
}

exports = module.exports = x=>new Renderer();