"use strict";
const urlFn = require("url");
const pathFn = require('path');
const yfm = require('hexo-front-matter');

function urlFor(url ,site) {
	if (site) {
		url = urlFn.resolve(hexo.config.url + "/", url);
	} else {
		url = urlFn.resolve(hexo.config.root, url);
	}
	return url;
}

function encodeHtml(str){
		var s ="";
		if(str.length==0)
		return "";
		s=str.replace(/&/g,"&gt;");
		s=s.replace(/</g,"&lt;");
		s=s.replace(/>/g,"&gt;");
		s=s.replace(/\"/g,"&quot;");
		s=s.replace(/\n/g,"<br>");
		return s;
}







function getFormatFunction(format) {
	if (typeof format === "function") {
		return format;
	}
	if (!(format && typeof format === "string")) {
		return x => "";
	}
	return index => format.replace(/\$((?:#+|[$iIaA@])?)(!?)(&?)((?:\d)?)/g, (b, t, z, a, n)=> {
		if (t == "$") {
			return "$" + z + n;
		}
		if (!n) {
			return b;
		}
		n = Number(n);
		if (n === 0) {
			return "";
		}
		if (a) {
			n = index[0][n - 1];
		} else {
			n = index[n];
		}
		if (!(n || n === 0)) {
			return "";
		}
		if (!z) {
			n++;
		}
		switch(t[0]) {
			case "i": n = ""; break;
			case "I": n = ""; break;
			case "a": n = ""; break;
			case "A": n = ""; break;
			case "@": n = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"][n] || ""; break;
			default: n = n;
		}
		return n;
	});
}

function list2tree(list) {
		let that = [];
		let parents = [that];
		for (let {level, title, path} of list) {
				while(parents.length > level) {
						parents.pop();
						that = parents[parents.length - 1];
				}
				while(parents.length < level) {
						let nthat = that[that.length - 1];
						if (!nthat) {
								that.push(nthat = {children: []});
						}
						parents.push(that = nthat.children);
				}
				that.push({title, path, children: []})
		}
		return parents[0];

}

function trans(list, format = [], index = [[]]) {
	if(!list) {
			return "";
	}
	const ret = [];
	let ffn = getFormatFunction(format[index.length - 1]);
	for(let i = 0, l = list.length; i < l; i++) {
		if (index[0].length < index.length) {
			index[0][index.length - 1] = 0;
		} else {
			index[0][index.length - 1]++;
		}
		let {path, title, children} = list[i];
		index.push(i);
		ret.push([
			ffn(index) + " " + title,
			path,
			trans(children, format, index),
		]);
		index.pop(i);
	}
	return ret.length ? ret : null;
}




function get(md, format) {
		let lists = [];
		let list;
		let s;
		for (let line of md.split("\n")) {
			//分析是否为目录
			let info = /^( *)(?:(?:\d+\.)|[\*]) (.*)$/.exec(line);
			if (!info) {
				list = null;
				continue;
			}
			//获取缩进及标题
			let level = info[1].length;
			let title = info[2];
			let path;
			//目录列表
			if (!list) {
					list = [];
					lists.push(list);
					s =  [];
			}
			//根据缩进判断目录级别
			while(s.length && s[s.length - 1] > level) {
					s.pop();
			}
			if (!s.length || s[s.length - 1] < level) {
					s.push(level);
			}
			level = s.length;
			//获取页面路径
			info = /^\s*\[(.*)\]\(([^\(\)\[\]]*)\)\s*$/i.exec(title);
			if (info) {
					title = info[1];
					path = info[2].replace(/\.md$/i,"");
			}
			//插入页面
			list.push({level, title, path});
		}
		return lists;
}





class Book {
	constructor(id) {
		this.id = id;
		this.pages = {
			index: {
				id:"index",
				raw:"",
				content:"",
				_content:"",
			}
		};
		this.assets = {};
		this.currentPath = 'index';
		this.isSummary = false;
		this.isIndex = true;
	}
	async addFile(file) {
		let path = file.params.path;
		if (/\.md$/.test(path)) {
			let stats = file.stat();
			let content = file.read();
			[stats, content] = await Promise.all([stats, content]);
			const data = yfm(content);
			data.content = (await hexo.render.render({text: data._content, engine:"markdown"})).replace(/(href="[^\:\/\"][^\:\"]+\.)md((?:[?#][^"]*)?")/gi, "$1html$2")
			data.source = file.path;
			data.raw = content;
			data.id = path.replace(/\.md/,"");
			this.pages[data.id] = data;
		} else {
			this.assets[path] = file;
		}

	}
	init() {
		if (this.inited) {
			return ;
		}
		this.inited = true;
		const README = this.pages.README || {};
		const SUMMARY = this.pages.SUMMARY || {};

		this.path			= urlFn.resolve((README.path || SUMMARY.path || this.id) + "/", "./");
		this.url			= README.url			|| SUMMARY.url		|| urlFor(this.path, true);
		this.title			= README.bookTitle		|| SUMMARY.bookTitle	;
		this.subtitle		= README.subtitle		|| SUMMARY.subtitle		;
		this.description	= README.description	|| SUMMARY.description	;
		this.keywords		= README.keywords		|| SUMMARY.keywords		;
		this.author			= README.author			|| SUMMARY.author		;
		this.image			= README.image			|| SUMMARY.image		;
		this.copyright		= README.copyright		|| SUMMARY.copyright	;

		if (SUMMARY.raw) {
			//列表及目录
			let format = SUMMARY.format || []
			let lists = get(SUMMARY.raw);
			this.list = [].concat(...lists.map(l =>l.map(({title, path, level}) => path ? {title, path} : null).filter(x=>x)));
			let summary = this.summary = lists.map(list2tree).map((list, index) => trans(list, format[index]));

			//默认目录
			let defaultSummaryId = SUMMARY.defaultSummaryId || SUMMARY.defaultSummaryIds;
			if (!Array.isArray(defaultSummaryId)) {
				defaultSummaryId = [0];
			}
			defaultSummaryId = [...new Set(defaultSummaryId.map(x=>parseInt(x)).filter(x => 0 <= x && x < summary.length))];
			this._defaultSummaryIds = defaultSummaryId;

			//目录类名
			let summaryClassName = SUMMARY.summaryClassName;
			if (!Array.isArray(summaryClassName)) {
				summaryClassName = [summaryClassName];
			}
			summaryClassName = summaryClassName.filter(x => x && typeof x === "string");
			if (!summaryClassName[0]) {
				summaryClassName = [""];
			}
			summaryClassName = summary.map((s,i) => summaryClassName[i % summaryClassName.length]);
			this._summaryClassName = summaryClassName;
		} else {
			this._defaultSummaryIds = [0];
			this._summaryClassName = [''];
			let list = [];
			let pages = this.pages;
			for (let k in pages) {
				if (k == "index" || k == "SUMMARY" || k == "README") {
					break;
				}
				list.push(pages[k]);
			}
			list = list.sort((a,b) => {
				if (a.path > b.path) {
					return 1;
				} else if (a.path < b.path) {
					return -1;
				} else {
					return 0;
				}
			});
			if (pages.SUMMARY) {
				list.unshift(pages.SUMMARY);
			}
			if (pages.README) {
				list.unshift(pages.README);
			}
			let summary = [];
			for (let page of list) {
				const path = page.path;
				let pathArray = path.split("/");
				pathArray.pop();
				let dirpath = "", dir, list = summary;
				while(dir = pathArray.shift()) {
					dirpath = dirpath ? dirpath + "/" + dir : dir;
					dir = null;
					for (let d of list) {
						if (d.path = dirpath) {
							dir = d;
							break;
						}
					}
					if (dir) {
						list.push(dir = ["", dirpath,[]]);
					}
					list = dir[2];
				}
				list.push([page.title, page.path, []]);
			}
		}
	}
	urlFor(p) {
		this.init();
		if (typeof p !== "string") {
			p = "";
		}
		p = p.replace(/\.md$/,".html");
		let n = p.split("/").pop();
		if (n && n.indexOf(".") == -1) {
			p += ".html";
		}
		return urlFor(urlFn.resolve(this.path, p));
	}
	make(path, page) {
		this.init();
		path = path.replace(/\.html$/g,"").replace(/\.md$/g,"");
		page = page || {};
		if (path in this.pages) {
			Object.assign(page, this.pages[path]);
		//	console.log(this.pages[path]);
		}
		page.url_for = page.urlFor = this.urlFor.bind(this);
		page.book = this;
		if (path == "index") {
			page.echo_summary = page.echoSummary = this.echoSummary.bind(this);
			page.is_summary = page.isSummary = this.isSummary;
			page.is_index = page.isIndex = this.isIndex;
			return page;
		}
		let that = Object.create(this);
		that.currentPath = path;
		page.echo_summary = page.echoSummary = this.echoSummary.bind(that);
		page.is_summary = page.isSummary = path == "SUMMARY";
		page.is_index = page.isIndex = false;


		let list = this.list;
		for (let i = 0; i < list.length; i++) {
			if (list[i].path === path || list[i].path + "index" === path) {
				let item = list[i + 1];
				if (item) {
					page.next = item.title;
					page.next_link = page.nextLink = this.urlFor(item.path);
				}
				item = list[i - 1];
				if (item) {
					page.prev = item.title;
					page.prev_link = page.prevLink = this.urlFor(item.path);
				}
				break;
			}
		}
		return page;
	}
	echoSummary(id, className, page) {
		this.init();
		page = page || this.currentPath;
		//如果是数组，则直接当目录输出
		if (Array.isArray(id)) {
			return this._echoSummary(id, className, page);
		}
		if (id == null) {
			//基础目录ID
			id = this._defaultSummaryIds;
		} else if (id === true) {
			//全部目录
			id = this.summary.map((it,i)=>i);
		} else if (!Array.isArray(id)) {
			//传入的目录
			id = [id];
		}
		return id.map(id => {
			let summary = this.summary[id];
			if (!Array.isArray(summary)) {
				return "";
			}
			summary = this._echoSummary(summary, className, page);
			if (!summary) {
				return "";
			}
			let scn = this._summaryClassName[id];
			return scn ? `<div class="${scn}">${summary}</div>` : `<div>${summary}</div>`;
		}).join("");
	}
	_echoSummary(summary, className, page) {
		const ret = [];
		for(let [title, path, children] of summary) {
			children = Array.isArray(children) && this._echoSummary(children, className, page);
			if (title || children) {
				ret.push("<li>");
				if(title) {
					if (path) {
						if (page === path && className) {
							ret.push(`<a class="${encodeHtml(className)}" href="${encodeHtml(this.urlFor(path))}">`);
						} else {
							ret.push(`<a href="${encodeHtml(this.urlFor(path))}">`);
						}
					}
					ret.push(encodeHtml(title));
					if (path) {
						ret.push("</a>");
					}
				}
				if (children) {
					ret.push(children);
				}
				ret.push("</li>");
			}
		}
		if (!ret.length) {
			return "";
		}
		return `<ul class="book-summary">${ret.join("")}</ul>`;
	}
	generatePages(locals) {
		this.init();
		const ret = [];
		const layout = ["book"];
		const pages = this.pages;
		for (let k in pages) {
			const path = urlFn.resolve(this.path, k + ".html");
			const data = this.make(k, Object.create(locals));
			ret.push({path , data, layout})
		}
		return ret;
	}
	generateAssets() {
		this.init();
		const ret = [];
		const assets = this.assets;
		for (let path in assets) {
			ret.push({path: urlFn.resolve(this.path, path), data: assets[path].read()});
		}
		return ret;
	}
}




const bookMap = {};
const books = [];
function getBook(id, create) {
	if (id in bookMap) {
		return bookMap[id];
	}
	if (create) {
		const book = new Book(id);
		bookMap[id] = book;
		books.push(book);
		return book;
	}
}

hexo.source.addProcessor('_book/:bookId/*path', function(file){
	let bookId = file.params.bookId;
	if (bookId[0] == "." || bookId[1] == "_") {
		return ;
	}
	let path = file.params.path;
	let pathArray = path.split("/");
	for (let name of pathArray) {
		if (name[0] == "." || name[1] == "_") {
			return ;
		}
	}
	return getBook(bookId, true).addFile(file);
});

function isBook(path) {
	return Boolean(this.book);
	let book = getBook.call(this, path);
	if (!book) {return false;}
}
hexo.extend.helper.register('is_book', isBook);
hexo.locals.set('books', x=>books);


hexo.extend.filter.register('template_locals', function(locals){
	locals.books = books;
	return locals;
});
hexo.extend.generator.register("books", locals => [].concat(...locals.books.map(book=>book.generatePages(locals))));
hexo.extend.generator.register("book:assets", locals => [].concat(...locals.books.map(book=>book.generateAssets(locals))));
