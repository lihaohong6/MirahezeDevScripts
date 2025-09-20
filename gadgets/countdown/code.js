// __NOWYSIWYG__
// <nowiki>
/**
 * Countdown
 *
 * @version 3.0 (ported from v2.2 on Fandom Developers Wiki)
 * Original source: 
 * https://dev.fandom.com/wiki/MediaWiki:Countdown/code.js?oldid=205282
 * https://dev.fandom.com/wiki/MediaWiki:Custom-Countdown/i18n.json?oldid=206294
 *
 * @author Pecoes <https://c.fandom.com/wiki/User:Pecoes>
 * @author Asaba <https://dev.fandom.com/wiki/User:Asaba>
 *
 * Version 1 authors:
 * - Splarka <https://c.fandom.com/wiki/User:Splarka>
 * - Eladkse <https://c.fandom.com/wiki/User:Eladkse>
 * 
 * Ported by: 
 * - CoolMikeHatsune22 <https://dev.miraheze.org/wiki/User:CoolMikeHatsune22>
 *
 * documentation and examples at:
 * <https://dev.fandom.com/wiki/Countdown>
 */

/*jshint jquery:true, browser:true, devel:true, camelcase:true, curly:false, undef:true, bitwise:true, eqeqeq:true, forin:true, immed:true, latedef:true, newcap:true, noarg:true, unused:true, regexp:true, strict:true, trailing:false */
/*global mediaWiki:true, importArticle:true*/

;(function (module, mw, $) {
	'use strict';

	var countdowns = [];

	var NO_LEADING_ZEROS = 1,
	SHORT_FORMAT = 2,
	NO_ZEROS = 4;
	
	var i18n;

	function getUnitMessage(unit, delta, isShort) {
		//var msg;
		/*if (isShort){
			msg = unit+'-short';
		} else if(delta % 10 === 1 && delta % 100 !== 11){
			msg = unit;
		} else if((delta%10 === 2 || delta%10 === 3 || delta%10 === 4) && delta%100 !== 12 && delta%100 !== 13 && delta%100 !== 14){
			msg = unit + 's';
		} else {
			msg = unit + 's2';
		}*/
		var msg = isShort ? (unit + '-short') :  mw.language.convertPlural(delta, [unit, unit+'s',unit+'s2']);
		var msgText = i18n.msg(msg).plain();
		if (isShort) {
		    return msgText;
		}
		return ' ' + msgText;
	}

	function output (i, diff) {
		/*jshint bitwise:false*/
		var delta, result, parts = [];
		var isShort = Boolean(countdowns[i].opts & SHORT_FORMAT);
		delta = diff % 60;
		result = getUnitMessage('second', delta, isShort);
		parts.unshift(delta + result);
		diff = Math.floor(diff / 60);
		delta = diff % 60;
		result = getUnitMessage('minute', delta, isShort);
		parts.unshift(delta + result);
		diff = Math.floor(diff / 60);
		delta = diff % 24;
		result = getUnitMessage('hour', delta, isShort);
		parts.unshift(delta + result);
		diff = Math.floor(diff / 24);
		result = getUnitMessage('day', diff, isShort);
		parts.unshift(diff + result);
		result = parts.pop();
		if (countdowns[i].opts & NO_LEADING_ZEROS) {
			while (parts.length && parts[0][0] === '0') {
				parts.shift();
			}
		}
		if (countdowns[i].opts & NO_ZEROS) {
			parts = parts.filter(function(part) {
				return part[0] !== '0';
			});
		}
		if (parts.length) {
			if (countdowns[i].opts & SHORT_FORMAT) {
				result = parts.join(' ') + ' ' + result;
			} else {
				result = parts.join(', ') + ' ' + i18n.msg('and').plain() + ' ' + result;
			}
		}
		countdowns[i].node.text(result);
	}

	function end(i) {
		var c = countdowns[i].node.parents('.countdown').first();
		switch (c.attr('data-end')) {
		case 'remove':
			c.remove();
			return true;
		case 'stop':
			output(i, 0);
			return true;
		case 'toggle':
			var toggle = c.attr('data-toggle');
			if (toggle && toggle === 'next') {
				c.next().css('display', 'inline');
				c.css('display', 'none');
				return true;
			}
			if (toggle && $(toggle).length) {
				$(toggle).css('display', 'inline');
				c.css('display', 'none');
				return true;
			}
			break;
		case 'callback':
			var callback = c.attr('data-callback');
			if (callback && $.isFunction(module[callback])) {
				output(i, 0);
				module[callback].call(c);
				return true;
			}
			break;
		}
		countdowns[i].countup = true;
		output(i, 0);
		return false;
	}

	function update () {
		var now = Date.now();
		var countdownsToRemove = [];
		$.each(countdowns.slice(0), function (i, countdown) {
			var diff = Math.floor((countdown.date - now) / 1000);
			if (diff <= 0 && !countdown.countup) {
				if (end(i)) countdownsToRemove.push(i);
			} else {
				output(i, Math.abs(diff));
			}
		});
		var x;
		while((x = countdownsToRemove.pop()) !== undefined) {
			countdowns.splice(x, 1);
		}
		if (countdowns.length) {
			window.setTimeout(function () {
				update();
			}, 1000);
		}
	}

	function getOptions (node) {
		/*jshint bitwise:false*/
		var c = node.parents('.countdown').first();
		var text = c.attr('data-options'),
			opts = 0;
		if (text) {
			if (/no-leading-zeros/.test(text)) {
				opts |= NO_LEADING_ZEROS;
			}
			if (/short-format/.test(text)) {
				opts |= SHORT_FORMAT;
			}
			if (/no-zeros/.test(text)) {
				opts |= NO_ZEROS;
			}
		}
		return opts;
	}

	function init($content) {
		var countdown = $content.find('.countdown:not(.handled)');
		if (!countdown.length) return;
		$content.find('.nocountdown').css('display', 'none');
		countdown
		.css('display', 'inline')
		.find('.countdowndate')
		.each(function () {
			var $this = $(this),
				date = (new Date($this.text())).valueOf();
			if (isNaN(date)) {
				$this.text(i18n.msg('bad-date').plain());
				return;
			}
			countdowns.push({
				node: $this,
				opts: getOptions($this),
				date: date,
			});
		});
		countdown.addClass('handled');
		if (countdowns.length) {
			update();
		}
	}
	
	function loadMessages() {
		var deferred = new $.Deferred();
		if (mw.loader.getState('ext.gadget.i18n-js')) {
			mw.loader.load('ext.gadget.i18n-js');
			mw.hook('dev.i18n').add(function (i18n) {
				i18n.loadMessages('Countdown', { 
					cacheVersion: 2
				}).done(function (messages) {
					if (!messages) { 
						deferred.resolve(loadFallbackMessages()); 
						return;
					}
					messages.useContentLang();
					deferred.resolve(messages);
				});
			});
			return deferred;
		}
		deferred.resolve(loadFallbackMessages());
		return deferred;
	}
	function loadFallbackMessages() {
		mw.messages.set({
			"Countdown__and": "and",
			"Countdown__second": "second",
			"Countdown__seconds": "seconds",
			"Countdown__minute": "minute",
			"Countdown__minutes": "minutes",
			"Countdown__hour": "hour",
			"Countdown__hours": "hours",
			"Countdown__day": "day",
			"Countdown__days": "days",
			"Countdown__bad-date": "Invalid Date",
			"Countdown__second-short": "s",
			"Countdown__minute-short": "m",
			"Countdown__hour-short": "h",
			"Countdown__day-short": "d",
			"Countdown__seconds2": "seconds",
			"Countdown__minutes2": "minutes",
			"Countdown__hours2": "hours",
			"Countdown__days2": "days"
		});
		return {
			msg: function () {
				arguments[0] = "Countdown__" + arguments[0];
				return mw.message.apply(this, arguments);
			}
		};
	}
	
	loadMessages().done(function (messages) {
		i18n = messages;
		mw.hook('wikipage.content').add(init);
	});

}(window.countdownTimer = window.countdownTimer || {}, mediaWiki, jQuery));

// </nowiki>