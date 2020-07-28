/**
 * @license
 * 
 * <gallery-mode-plugin>
 * 
 * <nodexer:gallery> [https://github.com/sixem/nodexer]
 * 
 * Licensed under MIT
 * @author   emy [admin@eyy.co]
 * @version  0.22 (1.1.61)
 */

(function($)
{
	'use strict';

	$.fn.gallery = function(items, options = {})
	{
		const main = {
			data : {
				busy : false,
				scrollbreak : false
			}
		};

		main.store = $.extend({
			extensions : {
				image : ['jpg', 'jpeg', 'gif', 'png', 'ico', 'svg', 'bmp', 'webp'],
				video : ['mp4', 'webm']
			},
			console : true,
			blur : true,
			filter : true,
			start : 0,
			fade : 0,
			mobile : false,
			scroll_interval : 35,
			autoplay : true,
			reverse_options : true,
			fit_content : false,
			list : {
				show : true,
				reverse : false
			},
			continue : {
				video : null
			}
		}, main.store, options);

		main.loadImage = (url) =>
		{
			return new Promise((resolve, reject) => {
				let img = new Image();

				img.addEventListener('load', () => resolve([url, img]));

				img.addEventListener('error', () =>
				{
					reject(new Error(`failed to load image URL: ${url}`));
				});

				img.src = url;
			});
		};

		main.getExtension = (filename) => (filename.split('.').pop()).toLowerCase();
		main.getObjectSet = (...elements) => $((elements.filter((value) => typeof value !== 'undefined')).map((element) => $(element)));

		main.filterItems = (items) => items.filter((item) => main.isImage(item.name) || main.isVideo(item.name));

		main.isImage = (filename, ext = null) => main.store.extensions.image.includes(ext ? ext : main.getExtension(filename));
		main.isVideo = (filename, ext = null) => main.store.extensions.video.includes(ext ? ext : main.getExtension(filename));

		main.getScrollBarWidth = (force = false) =>
		{
			if(!force) if($(document).height() <= $(window).height()) return 0;

			var outer = $('<div>').css({
				visibility: 'hidden', width: 100, overflow: 'scroll'
			}).appendTo('body')

			var widthWithScroll = $('<div>').css({
				width: '100%'
			}).appendTo(outer).outerWidth();

			outer.remove();

			return (100 - widthWithScroll);
		};

		main.limitBody = (bool = true) =>
		{
			/* removes the scrollbar from the body (to avoid it showing when the gallery is open)
			 * and adds a padding to it with the width of the scrollbar in order to avoid jumping elements. */

			var body = $('body'), html = $('html'), scrollpadding = main.getScrollBarWidth();

			if(bool === true)
			{
				main.data.body = {
					'max-height' : body.css('max-height'),
					'overflow' : body.css('overflow')
				};

				if(scrollpadding > 0) html.css({
					'padding-right' : scrollpadding + 'px'
				});

				body.css({
					'max-height' : 'calc(100vh - var(--height-gallery-top-bar))',
					'overflow' : 'hidden'
				});
			} else {
				if(Object.prototype.hasOwnProperty.call(main.data, 'body'))
				{
					body.css({
						'max-height' : main.data.body['max-height'],
						'overflow' : main.data.body.overflow
					});
				}

				html.css({
					'padding-right' : 'unset'
				});
			}
		};

		main.exists = () =>
		{
			main.container = $('div.gallery-container');

			return main.container.length > 0;
		};

		/**
		* Shows or hides the gallery. Can be called after the first initiation.
		* @param {bool}  bool  : whether to hide or show the gallery.
		* @param {int}   index : index to start at.
		* @param {array} items : if unset it will use the previously set items. pass this if the
		*                        order of items has changed or if there are any new items etc.
		*/

		main.show = (bool = true, index = null, items = null) =>
		{
			if(items)
			{
				if(main.store.console) console.log('itemsUpdate', true);

				main.data.selected.index = null;
				main.items = main.store.filter ? main.filterItems(items) : items;
				main.populateTable(main.items);
			}

			if(bool === true)
			{
				main.bind().show();

				if(index !== main.data.selected.index)
				{
					main.container.find('.media .wrapper img, .media .wrapper video').hide();
					main.navigate(index);
				}

				main.container.find('.list').scrollTo(main.container.find('> .list').find('tr').eq(index));
			} else {
				main.unbind(main.data.bound);
				main.container.hide();
			}

			if(main.store.blur)
			{
				main.setBlur(bool);
				main.limitBody(bool);
			}

			var video = main.container.find('.media .wrapper video'),
				table = main.container.find('.list table');

			if(video.length > 0)
			{
				if(bool === true && video.is(':visible'))
				{
					var current_time = 0;

					if(main.store.continue.video && video.find('source').attr('src') == main.store.continue.video.src)
					{
						current_time = main.store.continue.video.time;
						main.store.continue.video = null;
					}

					video[0].currentTime = current_time;
					video[0].muted = false;
					video[0][main.store.autoplay ? 'play' : 'pause']();
				} else if(bool === false)
				{
					video[0].muted = true;
					video[0].pause();
				}
			}

			if(table.length > 0)
			{
				if(main.data.list_drag) main.data.list_drag.css('height', table[0].scrollHeight + 'px');
			}
		};

		main.data.busy = null;
		main.data.busy_handle = null;

		main.tick = (loader) =>
		{
			var tick = parseInt(loader.attr('data-tick'));

			loader.text('Loading ' + ('.').repeat(tick)).attr('data-tick', (tick >= 3) ? 1 : (tick + 1));

			return loader;
		};

		main.busy = (bool) =>
		{
			if(typeof bool != 'undefined')
			{
				main.data.busy = bool;

				var loader = main.container.find('.media .loader');

				if(!$(loader)[0].hasAttribute('data-tick')) $(loader).attr('data-tick', 1);

				if(bool)
				{
					if(loader.is(':hidden')) loader.stop().fadeIn(400);

					main.data.busy_handle = setInterval(() => main.tick(loader), 225);
				} else {
					if(loader.is(':visible')) loader.stop().fadeOut(200, () => loader.attr('data-tick', 1).text('Loading .'));

					if(!main.data.busy) clearInterval(main.data.busy_handle);
				}
			}

			return main.data.busy;
		};

		main.populateTable = (items, table = null) =>
		{
			if(table === null) table = main.container.find('.list table');

			table.html('');

			items.forEach((data) => table.append(`<tr title="${data.name}"><td>${data.name}</td></tr>`));

			main.data.list_drag.css({
				'height' : table[0].scrollHeight + 'px'
			});

			return table;
		};

		main.hideExisting = (selector) =>
		{
			var e = main.container.find(selector).hide();

			return e.length > 0 ? e : null;
		};

		main.setBlur = (bool = true) =>
		{
			if(bool === true)
			{
				main.data.blurred = $('body > *:not(.gallery-container):not(script):not(noscript):not(style)').addClass('blur ns');
			} else {
				if(Object.prototype.hasOwnProperty.call(main.data, 'blurred'))
				{
					main.data.blurred.removeClass('blur ns');
				}
			}

			return main;
		};

		main.update = {
			listWidth : (wrapper = null) =>
			{
				if(!wrapper) wrapper = main.container.find('.media .wrapper');

				var list = main.data.list ? main.data.list : (main.container.find('div.list')),
					width = (main.store.mobile || !list || list.is(':hidden')) ? 0 : list.outerWidth();

				wrapper[0].style.setProperty('--width-list', width + 'px');
			}
		};

		main.getReverseOptions = (url) =>
		{
			url = encodeURIComponent(document.location.origin + url);

			return {
				'Google': 'https://www.google.com/searchbyimage?image_url=' + url + '&safe=off',
				'Yandex': 'https://yandex.com/images/search?rpt=imageview&url=' + url,
				'IQDB': 'https://iqdb.org/?url=' + url
			};
		};

		main.reverse = () =>
		{
			if(!main.store.reverse_options || 
				(main.container.find('.content-container .media .wrapper .cover')).length === 0) return false;

			var container = main.container.find('.content-container .media .reverse');

			if(container.length === 0)
			{
				container = $('<div/>', {
					class : 'reverse'
				}).appendTo(main.container.find('.content-container .media .wrapper .cover'));
			}

			var options = main.getReverseOptions(main.data.selected.src);

			container.html(
				Object.keys(options).map((site) => `<a class="reverse-link" target="_blank" href="${options[site]}">${site}</a>`)
			);
		};

		main.shortenString = (input, cutoff) =>
		{
			cutoff = cutoff || 28;

			if(input.length > cutoff)
			{
				return [
				input.substr(0, Math.floor((cutoff / 2) - 2)),
					input.substr(input.length - (Math.floor((cutoff / 2) - 2)), input.length)
				].join(' .. ');
			} else {
				return input;
			}
		};

		/* sets the item info for the current item (topbar left) */
		main.setItemInfo = (item, index, max) =>
		{
			if(main.store.console) console.log('itemSet', item);

			var name = main.store.mobile ? main.shortenString(item.name, 30) : item.name;

			main.container
			.find('.bar > .right > a.download')
			.attr('filename', item.name)
			.attr('href', item.url)
			.attr('title', `Download: ${item.name}`);

			main.container.find('.bar > .left').html(
				`<span>${index + 1} of ${max}</span>`+
				` | <a href="${item.url}">${name}</a>`+
				(Object.prototype.hasOwnProperty.call(item, 'size') && !main.store.mobile ? ` | <span>${item.size}</span>` : '')
			);
		};

		/* checks if an item is visible in the viewport (can be improved upon) */
		main.isScrolledIntoView = (elem, offset) =>
		{
			var top_margin = elem.offset().top - $(window).scrollTop();
			if(top_margin < offset) return false;

			var bottom_margin = (top_margin + elem.outerHeight());
			if(bottom_margin > $(window).height()) return false;

			return true;
		};

		/* scrolls an item into view (scrollto plugin is being used over this as this needs improvement) */
		main.scrollIntoView = (element, container) =>
		{
			container.stop().animate({
				scrollTop: (element.offset().top - container.offset().top)
			}, 0);
		};

		/* calculates the new value if using +/- when navigating items. ex ((50, -10) = 40) etc. */
		main.calculateIndex = (current, change, max) =>
		{
			var adjusted = (current + change);

			if(adjusted > max) adjusted = (adjusted - max) - 1;
			if(adjusted < 0) adjusted = max - (Math.abs(adjusted) - 1);
			if(adjusted < 0 || adjusted > max) return main.calculateIndex(current, (max - adjusted), max);

			return adjusted;
		};

		main.createVideo = (extension) =>
		{
			var attributes = {
				controls : '',
				loop : ''
			};

			if(main.store.autoplay) attributes.autoplay = '';

			var video = $('<video/>', attributes);

			var source = $('<source>', {
				type : 'video/' + extension, src : ''
			}).appendTo(video);

			return [video, source];
		};

		main.showItem = (type, element, src, init, index, data = null) =>
		{
			var wrapper = main.container.find('.media .wrapper'), video, source;

			if(main.store.fade > 0) wrapper.hide();

			var applyChange = () =>
			{
				var opp = wrapper.find(type === 0 ? 'video' : 'img').hide();

				if(type === 1)
				{
					opp.parent('.cover').hide();
				}

				if(main.store.fade > 0)
				{
					wrapper.stop().fadeOut(main.store.fade, () =>
					{
						wrapper.stop().fadeIn(main.store.fade);
					});
				} else {
					wrapper.show();
				}

				main.busy(false);
			};

			var display = () =>
			{
				if(type === 0)
				{
					video = wrapper.find('video');

					if(main.store.console) console.log('itemDimensions', data.img.height, 'x', data.img.width);

					if(main.store.fit_content)
					{
						var height = `calc(calc(100vw - var(--width-list)) / ${(data.img.width / data.img.height).toFixed(4)})`;
						
						main.update.listWidth(wrapper);

						element.css({
							width : 'auto',
							height : height
						});

						element.parent('.cover').css('height', height);
					}

					element.attr('src', src).show();
					element.parent('.cover').show();

					if(video.length > 0)
					{
						video[0].pause();
						video.find('source').attr('src', '');
					}

					applyChange();
				} else if(type === 1)
				{
					if(init === false)
					{
						[video, source] = main.createVideo(main.data.selected.ext);
						video.appendTo(wrapper);
					} else {
						source = element.find('source');
						video = element;
					}

					var can_play_triggered = false;

					source.attr('src', src);

					video.off('canplay canplaythrough').on('canplay canplaythrough', () =>
					{
						if(can_play_triggered) return false;

						var height = video[0].videoHeight,
							width = video[0].videoWidth;

						if(main.store.console) console.log('itemDimensions', height, 'x', width);

						if(main.store.fit_content)
						{
							main.update.listWidth(wrapper);

							video.css({
								width : 'auto',
								height : `calc(calc(100vw - var(--width-list)) / ${(width / height).toFixed(4)})`
							});
						}

						video.show();

						/* if the gallery was hidden while loading, pause video and hide loader. */
						if(!main.container.is(':visible'))
						{
							main.container.find('.media .loader').hide();
							video[0].pause();
						}

						if(init === false)
						{
							element.remove();
						}

						can_play_triggered = true;

						applyChange();
					});

					video[0].load();

					if(main.store.continue.video && src == main.store.continue.video.src)
					{
						video[0].currentTime = main.store.continue.video.time;
						main.store.continue.video = null;
					}
				}

				main.data.selected.index = index;
			};

			display();
		};

		main.navigate = (index, step = null) =>
		{
			if(main.store.console) console.log('busyState', main.busy());

			if(main.busy()) return false;

			var max = main.items.length - 1;

			if(index === null) index = main.data.selected.index;
			if(step !== null) index = main.calculateIndex(index, step, max);
			if(main.data.selected.index === index || main.busy() === true) return;

			var item = main.items[index]; main.setItemInfo(item, index, max + 1);

			main.data.selected.src = item.url;
			main.data.selected.ext = main.getExtension(item.name);

			var list = main.container.find('.list'), table = list.find('table'), elem = table.find('tr').eq(index);

			table.find('tr.selected').removeAttr('class');
			elem.attr('class', 'selected');

			if(!main.isScrolledIntoView(elem, Math.floor(main.container.find('.bar').outerHeight() - 4))) list.scrollTo(elem);

			var video, image, init;

			if(main.isImage(null, main.data.selected.ext))
			{
				main.busy(true);

				image = main.container.find('.media .wrapper img');
				video = main.container.find('.media .wrapper video');

				init = (image.length === 0);

				if(video.length > 0)
				{
					video[0].pause();
				}

				if(init === true)
				{
					var cover = $('<div/>', {
						class : 'cover'
					}).hide().prependTo(main.container.find('.media .wrapper'));

					image = $('<img>').prependTo(cover);
				}

				main.loadImage(item.url)
				.then((e) =>
				{
					let [src, img] = e;

					if(main.data.selected.src === src)
					{
						main.showItem(0, image, src, init, index, {
							img
						});
					}
				}).catch((err) =>
				{
					main.busy(false);
					console.error(err);
				});

				return true;
			}

			if(main.isVideo(null, main.data.selected.ext))
			{
				main.busy(true);

				video = main.container.find('.media .wrapper video');
				init = (video.length === 0);

				if(init)
				{
					video = main.createVideo(main.data.selected.ext)[0];
					video.appendTo(main.container.find('.media .wrapper'));
				}

				main.showItem(1, video, item.url, init, index);

				return true;
			}
		};

		main.data.key_prevent = [33, 34, 37, 38, 39, 40, 71];

		main.handleKey = (key, callback) =>
		{
			if(main.store.console) console.log('handleKey', key);

			if(key === 27)
			{
				main.show(false);
			} else if(key === 40 || key === 34 || key === 39)
			{
				main.navigate(null, 1);
			} else if(key === 38 || key === 33 || key === 37)
			{
				main.navigate(null, -1);
			} else if(key === 76)
			{
				main.toggleList();
			}

			callback(main.data.key_prevent.includes(key));
		};

		main.unbind = (bound, event = true) =>
		{
			bound.forEach((value) =>
			{
				if(Object.prototype.hasOwnProperty.call(value, 'direct') && value.direct === true)
				{
					$(value.trigger).off(value.event);

					return true;
				}

				(value.trigger) ? $(document).off(value.event, value.trigger) : $(document).off(value.event);

			});

			if(event === true) $(main).trigger('unbound', true);
		};

		main.scrollBreak = () =>
		{
			main.data.scrollbreak = false;
		};

		main.toggleList = (e = null) =>
		{
			var list = main.container.find('.list'), visible = list.is(':visible'), client = JSON.parse(Cookies.get('ei-client'));

			client.gallery.list_state = (!visible ? 1 : 0);

			Cookies.set('ei-client', JSON.stringify(client), {
				sameSite : 'lax',
				expires : 365
			});

			e = (!e ? $('.gallery-container div.bar .right span[data-action="toggle"]') : e);

			e.text('List' + (visible ? '+' : '-'));
			list.css('display', visible ? 'none' : 'table-cell');

			main.update.listWidth();

			return !visible;
		}

		main.bind = () =>
		{
			main.data.bound = [
				{
					event : 'click',
					trigger : 'div.gallery-container .list table tr'
				},
				{
					event : 'click',
					trigger : 'div.gallery-container [data-action="close"]'
				},
				{
					event : 'click',
					trigger : 'div.gallery-container [data-action="toggle"]'
				},
				{
					event : 'click',
					trigger : 'div.gallery-container [data-action="previous"]'
				},
				{
					event : 'click',
					trigger : 'div.gallery-container [data-action="next"]'
				},
				{
					event : 'click',
					trigger : 'div.gallery-container .media'
				},
				{
					event : 'DOMMouseScroll mousewheel',
					trigger : 'div.gallery-container .media'
				},
				{
					event : 'mouseover',
					trigger : 'div.gallery-container .media .wrapper img'
				},
				{
					event : 'mouseleave',
					trigger : 'div.gallery-container .media .wrapper img'
				},
				{
					event : 'mouseenter',
					trigger : 'div.gallery-container .media .wrapper .cover'
				},
				{
					event : 'swipeleft',
					trigger : 'div.gallery-container',
					direct : true
				},
				{
					event : 'swiperight',
					trigger : 'div.gallery-container',
					direct : true
				},
				{
					event : 'mouseup',
					trigger : '.gallery-container'
				},
				{
					event : 'keydown',
					trigger : null
				},
				{
					event : 'keyup',
					trigger : null
				}
			];

			main.unbind(main.data.bound, false);

			main.data.list_drag.on('mousedown', () =>
			{
				main.data.list_dragged = true;

				var window_width = window.innerWidth,
					wrapper = main.container.find('.media .wrapper');

				$('body').css('cursor', 'w-resize');
				wrapper.css('pointer-events', 'none');

				$(document).on('mousemove', '.gallery-container', (e) =>
				{
					var x = e.originalEvent.clientX;

					if(x < window_width)
					{
						var width = main.store.list.reverse ? (x + main.data.scrollbar_width) : (window_width - x);

						main.data.list.css('width', width + 'px');
					}
				});
			});

			$(document).on('mouseup', '.gallery-container', () =>
			{
				if(main.data.list_dragged === true)
				{
					$(document).off('mousemove', '.gallery-container');

					var wrapper = main.container.find('.media .wrapper');

					$('body').css('cursor', '');
					wrapper.css('pointer-events', 'auto');

					var lw = parseInt(main.data.list.css('width').replace(/[^-\d.]/g, ''));

					if(lw > 100)
					{
						var client = JSON.parse(Cookies.get('ei-client'));

						client.gallery.list_width = lw;

						Cookies.set('ei-client', JSON.stringify(client), {
							sameSite : 'lax',
							expires : 365
						});

						main.update.listWidth(wrapper);
					}
				}
			});

			$(document).on('click', 'div.gallery-container [data-action="close"]', () =>
			{
				main.show(false);
			});

			$(document).on('click', 'div.gallery-container [data-action="toggle"]', (e) =>
			{
				main.toggleList($(e.currentTarget));
			});

			$(document).on('click', 'div.gallery-container [data-action="previous"]', () =>
			{
				main.navigate(null, -1);
			});

			$(document).on('click', 'div.gallery-container [data-action="next"]', () =>
			{
				main.navigate(null, 1);
			});

			$(document).on('click', 'div.gallery-container .list table tr', (e) =>
			{
				main.navigate($(e.currentTarget).index());
			});

			$(document).on('click', 'div.gallery-container .media', (e) =>
			{
				if(!$(e.target).is('img, video, a')) main.show(false);
			});

			if(main.store.reverse_options === true)
			{
				$(document).on('mouseenter', 'div.gallery-container .media .wrapper .cover', (e) =>
				{
					main.reverse($(e.currentTarget));
				});
			}

			if(main.store.mobile === true)
			{
				$('div.gallery-container').on('swipeleft', () => main.navigate(null, 1));
				$('div.gallery-container').on('swiperight', () => main.navigate(null, -1));
			}

			$(document).on('DOMMouseScroll mousewheel', 'div.gallery-container .media', (e) =>
			{
				if(main.store.scroll_interval > 0 && main.data.scrollbreak === true) return false;

				main.navigate(null, (e.originalEvent.detail > 0 || e.originalEvent.wheelDelta < 0) ? 1 : -1);

				if(main.store.scroll_interval > 0)
				{
					main.data.scrollbreak = true;

					setTimeout(() => main.scrollBreak(), main.store.scroll_interval);
				}
			});

			$(document).on('keydown', $.fn, (e) =>
			{
				if(main.data.key_prevent.includes(e.keyCode)) e.preventDefault();

				if(e.keyCode === 71)
				{
					main.show(false);
				}
			});

			$(document).on('keyup', $.fn, (e) =>
			{
				main.handleKey(e.keyCode, (prevent) =>
				{
					if(prevent) e.preventDefault();
				});
			});

			$(main).trigger('bound', true);

			return main.container;
		};

		main.barConstruct = (bar) =>
		{
			$('<a/>', {
				text : main.store.mobile ? 'Save' : 'Download', class : 'download', 'download' : '',
			}).appendTo(bar);

			if(!main.store.mobile) $('<span/>', {
				'data-action' : 'previous', text : 'Previous'
			}).appendTo(bar);

			if(!main.store.mobile) $('<span/>', {
				'data-action' : 'next', text : 'Next'
			}).appendTo(bar);

			if(!main.store.mobile) $('<span/>', {
				'data-action' : 'toggle', text : main.store.list.show ? 'List-' : 'List+'
			}).appendTo(bar);

			$('<span/>', {
				'data-action' : 'close', text : 'Close'
			}).appendTo(bar);
		};

		var initiate = (callback) =>
		{
			main.limitBody(true);

			var previews = $('body').find('#image-preview, #video-preview');

			if(previews.length > 0) previews.remove();

			main.container = $('<div/>', {
				class : 'gallery-container',
			}).prependTo('body');

			var top = $('<div/>', {
				class : 'bar'
			}).appendTo(main.container);

			$('<div/>', {
				class : 'left'
			}).appendTo(top);

			main.barConstruct($('<div/>', {
				class : 'right'
			}).appendTo(top));

			var content = $('<div/>', {
				class : 'content-container'
			}).appendTo(main.container);

			var media = $('<div/>', {
				class : 'media'
			});

			var list = $('<div/>', {
				class : 'ns list' + (main.store.list.reverse ? ' reversed' : '')
			});

			content
			.append(main.store.list.reverse ? list : media)
			.append(main.store.list.reverse ? media : list);

			main.data.list_drag = $('<div/>', {
				class : 'drag' + (main.store.list.reverse ? ' reversed' : '')
			}).appendTo(list);

			main.data.list = list;
			main.data.list_dragged = false;
			main.data.scrollbar_width = main.getScrollBarWidth(true);

			var client = JSON.parse(Cookies.get('ei-client'));

			try
			{
				var width = JSON.parse(client.gallery.list_width.toString().toLowerCase());

				if(width === false)
				{
					width = '';
				} else if(parseInt(width) > (window.innerWidth / 2))
				{
					client.gallery.list_width = Math.floor(window.innerWidth / 2);

					Cookies.set('ei-client', JSON.stringify(client), {
						sameSite : 'lax',
						expires : 365
					});
				}

				main.data.list.css('width', width);
			} catch (e) {
				client.gallery.list_width = false;

				Cookies.set('ei-client', JSON.stringify(client), {
					sameSite : 'lax',
					expires : 365
				});
			}

			if(!main.store.list.show) list.hide();

			if(main.store.mobile === true)
			{
				list.hide();

				$('<span/>', {
				}).appendTo(
					$('<div/>', {
						class : 'screen-nav left',
						'data-action' : 'previous'
				}).appendTo(content));

				$('<span/>', {
				}).appendTo(
					$('<div/>', {
						class : 'screen-nav right',
						'data-action' : 'next'
				}).appendTo(content));
			}

			$('<div/>', {
				class : 'wrapper' + (main.store.fit_content ? ' fill' : '')
			}).appendTo(media);

			$('<div/>', {
				class : 'loader' + (main.store.list.reverse ? ' reversed' : '')
			}).html('Loading ..').appendTo(media);

			$('<tbody/>').appendTo(
				$('<table/>', {
					cellspacing : '0'
				}).appendTo(list)
			);

			main.populateTable(main.items);
			callback(true);
		}

		main.container = $('div.gallery-container');
		main.items = main.store.filter ? main.filterItems(items) : items;

		if(main.items.length === 0) return false;

		main.data.selected = {
			src : null,
			ext : null,
			index : null,
			type : null
		};

		if(!main.exists())
		{
			initiate(() =>
			{
				if(main.store.blur) main.setBlur(true).bind();
			});
		} else {
			main.show(true);
		}

		main.navigate(
			main.store.start > (main.items.length - 1) ? (main.items.length - 1) : main.store.start
		);

		return main;
	};
}(jQuery));