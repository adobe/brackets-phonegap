	/*
 * Copyright (c) 2012 Adobe Systems Incorporated. All rights reserved.
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
 * DEALINGS IN THE SOFTWARE.
 * 
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

require.config({
    paths: {
        "text" : "lib/text",
        "i18n" : "lib/i18n"
    },
    locale: navigator.language
});

define(function (require, exports, module) {
    "use strict";

	var Strings = require("strings");

    var CommandManager = brackets.getModule("command/CommandManager"),
		ProjectManager = brackets.getModule("project/ProjectManager"),
		EditorManager  = brackets.getModule("editor/EditorManager"),
        Menus          = brackets.getModule("command/Menus"),
        Dialogs		   = brackets.getModule("widgets/Dialogs"),
        FileUtils      = brackets.getModule("file/FileUtils"),
		eve,
		format         = (function () {
		    var tokenRegex = /\{([^\}]+)\}/g,
		        objNotationRegex = /(?:(?:^|\.)(.+?)(?=\[|\.|$|\()|\[('|")(.+?)\2\])(\(\))?/g, // matches .xxxxx or ["xxxxx"] to run over object properties
		        replacer = function (all, key, obj) {
		            var res = obj;
		            key.replace(objNotationRegex, function (all, name, quote, quotedName, isFunc) {
		                name = name || quotedName;
		                if (res) {
		                    if (name in res) {
		                        res = res[name];
		                    }
		                    typeof res == "function" && isFunc && (res = res());
		                }
		            });
		            // res = (res == null || res == obj ? all : res) + "";
		            return res + "";
		        };
		    return function (str, obj) {
		        return String(str).replace(tokenRegex, function (all, key) {
		            return replacer(all, key, obj);
		        });
		    };
		})();

	require("widgets/bootstrap-alerts.js");
	require("qrcode");
	require(["zip", "zip-fs"]);
	require(["eve"], function (eve) {
		zip.workerScriptsPath = "extensions/user/brackets-phonegap/";
				
		eve.f = function (event) {
			var attrs = [].slice.call(arguments, 1);
			return function () {
				eve.apply(null, [event, null].concat(attrs).concat([].slice.call(arguments, 0)));
			};
		};
		
	    var PG_COMMAND_ID = "phonegap.build";   // package-style naming to avoid collisions
	    CommandManager.register(Strings.COMMAND_NAME, PG_COMMAND_ID, eve.f("pgb.button.click"));

	    // Then create a menu item bound to the command
	    // The label of the menu item is the name we gave the command (see above)
	    var menu = Menus.getMenu(Menus.AppMenuBar.VIEW_MENU);
	    menu.addMenuItem(Menus.DIVIDER);
	    menu.addMenuItem(PG_COMMAND_ID);
	
	
		var button = $("<a>"),
			path2 = require.nameToUrl("icon.svg");
		path2 = path2.substring(0, path2.indexOf("icon.svg["));


		// fires "zip" for current project directory
		// 
		// eve.on("zip", function () {
		// 	console.log(this);
		// });
		
		function zipProject(f) {
			var rootPath = ProjectManager.getProjectRoot().fullPath,
				files = [],
				count = {
					c: 0,
					on: function () {
						this.c++;
					},
					off: function () {
						this.c--;
						!this.c && fs.exportBlob(f);
					}
				},
				fs = new zip.fs.FS;
			function getRelPath(root, path) {
				root = root.split("/");
				path = path.split("/");
				while (path[0] == root[0]) {
					path.splice(0, 1);
					root.splice(0, 1);
				}
				return new Array(root.length + 1).join("../") + path.join("/");
			}
			function processFile(path, blob) {
				var dirs = path.split("/"),
					root = fs.root;
				for (var i = 0, ii = dirs.length - 1, dir; i < ii; i++) {
					dir = root.getChildByName(dirs[i]);
					if (dir) {
						root = dir;
					} else {
						root = root.addDirectory(dirs[i]);
					}
				}
				root.addBlob(dirs[dirs.length - 1], blob);
				count.off();
			}
			function readfile(path) {
				var xhr = new XMLHttpRequest;
				xhr.onload = function() {
					processFile(path, xhr.response);
				}
				xhr.responseType = "blob";
				xhr.open("get", getRelPath(FileUtils.getNativeBracketsDirectoryPath(), path), false);
				xhr.send();
			}
			function readdir(path) {
				count.on();
				brackets.fs.readdir(path, function (err, filelist) {
					for (var i = 0; i < filelist.length; i++) {
						(function (filename) {
							count.on();
			                brackets.fs.stat(filename, function (statErr, statData) {
			                    if (!statErr) {
			                        if (statData.isDirectory()) {
			                            readdir(filename + "/");
			                        } else if (statData.isFile()) {
										count.on();
			                            readfile(filename);
			                        }
			                    }
								count.off();
			                });
						})(path + filelist[i]);
					}
					count.off();
				});
			}
			readdir(rootPath);
		}
		function updateApp(id) {
			if (!id) id = linkedProjectId;
			zipProject(function (blob) {
				// console.warn("zip", blob);
				var xhr = new XMLHttpRequest(),
					upload = xhr.upload;
				upload.addEventListener("progress", function (ev) {
					if (ev.lengthComputable) {
						var progress = ev.loaded / ev.total,
							pr20 = Math.round(progress * 20);
						console.log("[" + new Array(pr20 + 1).join("\u2588") + new Array(20 - pr20 + 1).join("\xb7") + "]");
					}
				}, false);
				upload.addEventListener("load", function (ev) {
					console.log("done");
				}, false);
				upload.addEventListener("error", function (ev) {console.log(ev);}, false);
				xhr.open(
					"PUT",
					"https://build.phonegap.com/api/v1/apps/" + id + "?auth_token=" + token
		        );
		        xhr.setRequestHeader("Cache-Control", "no-cache");
		        xhr.send(blob);
			});
		}

		button.attr({
			title: "testing…",
			id: "pgb-btn",
			href: "#",
			"class": "disabled"
		}).html('<link rel="stylesheet" href="' + path2 + 'pgb.css">')
		.click(eve.f("pgb.button.click"));
		button.insertAfter("#toolbar-go-live");
		// $("#gold-star").insertBefore(button);
	
		var $panel = $('<div id="pgb-panel" class="bottom-panel">\
			    <div class="toolbar simple-toolbar-layout">\
			        <div class="title">' + Strings.COMMAND_NAME + '</div>\
			        <div class="title" id="search-result-summary"></div>\
			        <a href="#" class="close">&times;</a>\
			    </div>\
			    <div class="table-container"></div>\
				<div id="pgb-anim">&nbsp;</div>\
			</div>'),
			anim = $("#pgb-anim", $panel);
		$(".content").append($panel);
		$(".close", $panel).click(eve.f("pgb.panel.close"));

		var $tableContainer = $(".table-container", $panel),
			$projectContainer = $("<div>").attr("id", "pgb-link-container"),
			panelOpened,
			token,
			linkedProjectId;
		
		function ajax(url, name, type, username, password) {
			console.log("ajax", url, name, type, username, password);
			eve("pgb.status.progress");
			var fullUrl = "https://build.phonegap.com/" + url + (token ? "?auth_token=" + token : "") + "?" + new Date().getTime();
			console.log("ajax", fullUrl);
			$.ajax({
	            url: fullUrl,
	            type: type || "get",
	            error: eve.f("pgb.error." + name),
	            success: eve.f("pgb.success." + name),
	            username: username,
	            password: password,
				dataType: "json",
	            cache: false,
	            crossDomain: true
	        });
		}

		// TODO: Complete. Currently just for testing.
		function showAlert(message) {
			var $alert = $("<div>").css("display", "none").addClass("alert-message fade in").append( $("<button>").attr({"class":"close", "type":"button", "data-dismiss":"alert"}).html("&times;") );
			$alert.append($("<h4>").html("This is an alert"));
			$alert.append($("<a>").addClass("btn").html("OK"));
			$alert.append( $("<a>").addClass("btn danger").html("Cancel").click(function() {$(".alert-message").alert("close")} ) );
			console.log($alert);
			$("#main-toolbar").after($alert);
			$(".alert-message").alert();
			$alert.slideDown("slow");
		}

		eve.on("pgb.status", function () {
			var type = eve.nt().split(/[\.\/]/)[2];
			button[0].className = type;
			anim[type == "progress" ? "show" : "hide" ]();
		});
		eve.on("pgb.login", function (login, password) {
			console.log("pgb.login");
			eve("pgb.anim");
			ajax("token", "login", "post", login, password);
		});
		eve.on("pgb.list", function () {
			ajax("api/v1/apps", "list");
		});
		eve.on("pgb.projectinfo", function (id) {
			ajax("api/v1/apps/" + id, "projectinfo");
		});
		eve.on("pgb.button.click", function () {
			if (!token) {
				eve("pgb.before.login");
			}
			eve("pgb.panel.open");
		});
		
		eve.on("pgb.before.login", function () {
			var $form = $('<form action="#" style="text-align: center">\
				<input type="email" name="username" placeholder="' + Strings.USERNAME_PLACEHOLDER + '"><br><br>\
				<input type="password" name="password" placeholder="' + Strings.PASSWORD_PLACEHOLDER + '"><br><br>\
				<input type="submit" class="btn primary" value=" ' + Strings.LOGIN_BUTTON_LABEL + ' ">\
			</form>');
			$tableContainer.empty().append($form);
			var inputs = $("input", $form);
			$form.on("submit", function (e) {
				e.preventDefault();
				eve("pgb.login", null, inputs[0].value, inputs[1].value);
			});
		});
		eve.on("pgb.panel.open", function () {
			$panel.show();
			EditorManager.resizeEditor();
		});
		eve.on("pgb.panel.close", function () {
			$panel.hide();
			EditorManager.resizeEditor();
		});
		
		eve.on("pgb.error", function (json) {
			console.log("pgb.error");
			Dialogs.showModalDialog(Dialogs.DIALOG_ID_ERROR, Strings.LOGIN_FAILED_DIALOG_TITLE, Strings.LOGIN_FAILED_DIALOG_MESSAGE);
			eve("pgb.status.error");
		});
		eve.on("pgb.success", function (json) {
			console.log("pgb.success");
			eve("pgb.status.normal");
		});
		eve.on("pgb.success.login", function (json) {
			console.log("pgb.success.login", json);
			token = json.token;

			var PGB_LINK_COMMAND_ID = "phonegap.build.link";
			CommandManager.register("Link with PhontGap Build Project", PGB_LINK_COMMAND_ID, eve.f("pgb.link"));
			var menu = Menus.getContextMenu("project-context-menu");
	        menu.addMenuDivider();
    	    menu.addMenuItem(PGB_LINK_COMMAND_ID);

			eve("pgb.status.normal");
			eve("pgb.list");
		});
		
		eve.on("pgb.success.list", function (json) {
			console.log("pgb.success.list", json);
			// eve("pgb.projectinfo", null, json.apps[0].id);
			var html = '<table class="condensed-table">';
			for (var i = 0; i < json.apps.length; i++) {
				var app = json.apps[i];
				html += format('<tr><td><img src="https://build.phonegap.com{icon.link}" height="20" alt="icon" style="margin: -5px"></td><td><a href="#" data-url="https://build.phonegap.com/apps/{id}" class="project-link">{title}</a></td><td>\
				<span data-download="{download.ios}" id="pgb-app-ios-{id}" class="icon ios-{status.ios}"></span>\
				<span data-download="{download.android}" id="pgb-app-android-{id}" class="icon android-{status.android}"></span>\
				<span data-download="{download.winphone}" id="pgb-app-winphone-{id}" class="icon win-{status.winphone}"></span>\
				<span data-download="{download.blackberry}" id="pgb-app-blackberry-{id}" class="icon bb-{status.blackberry}"></span>\
				<span data-download="{download.webos}" id="pgb-app-webos-{id}" class="icon hp-{status.webos}"></span>\
				<span data-download="{download.symbian}" id="pgb-app-symbian-{id}" class="icon symbian-{status.symbian}"></span>\
				</td><td class="pgb-desc"><a href="#" class="pgb-rebuild" data-id="{id}">Rebuild</a></td></tr>\n', app);
			}
			html += "</table>";
			$tableContainer.html(html);
			$tableContainer.click(eve.f("pgb.click"));
            $(".project-link").click(function (e) {
                eve("pgb.url.open", null, $(e.target).attr("data-url"));
            });

            var $linkDialogInstructions = $("<p>").attr("id", "pgb-link-dialog-instructions").append(Strings.LINK_DIALOG_INSTRUCTIONS);
			var linkHtml = '<table class="condensed-table">';
			for (var i = 0; i < json.apps.length; i++) {
				var app = json.apps[i];
				linkHtml += format('<tr><td><input class="pgb-project-radio" type="radio" name="pgb-projects" value="{id}"/></td>\
									<td><span class="project-title" for="cb-{id}">{title}</span><p>{description}</p></td></tr>\n', app);
			}
			linkHtml += "</table></div>";
			$projectContainer.empty();
			$projectContainer.append($linkDialogInstructions);
			$projectContainer.append(linkHtml);
		});
		eve.on("pgb.click", function (e) {
			var span = e.target;
			if (!String(span.id).indexOf("pgb-app")) {
				var data = $(span).attr("data-download");
				if (data == {}) {
					return;
				}
				var qr = qrcode(5, "L");
				qr.addData("https://build.phonegap.com" + data + "?qr_key=" + token);
				qr.make();
				qr = qr.createSVGPath(4);
				var $qrcode = $(format('<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="215" height="240">\
				<defs>\
					<filter id="blur" x="-20" y="-20" width="30" height="30">\
						<feGaussianBlur in="SourceGraphic" stdDeviation="10"/>\
					</filter>\
				</defs>\
			<g transform="translate(20, 20)">\
				<path id="shadow" filter="url(#blur)" opacity=".75" d="M10,183.257c-8.284,0-15-6.716-15-15v-148c0-8.284,6.716-15,15-15h148c8.284,0,15,6.716,15,15v148c0,8.284-6.716,15-15,15h-40.308l-33.692,24.18l-33.692-24.18H10z"/>\
				<path fill="#fff" d="M10,173c-8.284,0-15-6.716-15-15v-148c0-8.284,6.716-15,15-15h148c8.284,0,15,6.716,15,15v148c0,8.284-6.716,15-15,15h-40.308l-33.692,46.436l-33.692-46.436H10z"/>\
			</g>\
				<path d="{d}" transform="translate(30, 30)"/></svg>', qr));
				var spanOffset = $(span).offset();
				$qrcode.css({
					position: "absolute",
					zIndex: 2000,
					top: spanOffset.top - 240,
					left: spanOffset.left - 94
				}).appendTo(window.document.body);
				setTimeout(function () {
					$(window.document).one("click", function () {
						$qrcode.remove();
					});
				});
				// $qrcode.css({margin: "10 " + (560 / 2 - qr.size / 2)});
				// 		        $("<div class='modal hide' />")
				// 		            .append($('<div class="modal-header" />')
				//         .append('<a href="#" class="close">&times;</a>')
				// 			            .append('<h1 class="dialog-title">QR Code</h1>'))
				// 		            .append($qrcode)
				// 		            .appendTo(window.document.body)
				// 		            .modal({
				// 		                backdrop: "static",
				// 		                show: true
				// 		            });
				
			}
			if (span.className == "pgb-rebuild") {
				eve("pgb.rebuild", null, span.getAttribute("data-id"));
			}
		});
		eve.on("pgb.success.projectinfo", function (json) {
			console.warn(2, json);
		});
		eve.on("pgb.rebuild", function (id) {
			console.log("pgb.rebuild", id);
			ajax("api/v1/apps/" + id, "rebuild", "put");
		});
		eve.on("pgb.success.rebuild", function () {
			// TODO: Some kind of message
			console.log("pgb.success.rebuild");
		});
		eve.on("pgb.failure.rebuild", function () {
			// TODO: Some kind of message
			console.log("pgb.failure.rebuild");
		});
        eve.on("pgb.url.open", function(url) {
            brackets.app.openURLInDefaultBrowser(function (err) {}, url);
        });
        eve.on("pgb.radio.click", function(id) {
        	console.log("pgb.radio.click", id);
        	if (!linkedProjectId) {
				var PG_BUILD_COMMAND_ID = "phonegap.build.build";
				CommandManager.register(Strings.FILE_MENU_ENTRY, PG_BUILD_COMMAND_ID, updateApp);
				var fileMenu = Menus.getMenu(Menus.AppMenuBar.FILE_MENU);
				fileMenu.addMenuItem(Menus.DIVIDER);
				fileMenu.addMenuItem(PG_BUILD_COMMAND_ID);        		
        	}
        	linkedProjectId = id;
        });
        eve.on("pgb.link", function() {
        	console.log("pgb.link");
			Dialogs.showModalDialog(Dialogs.DIALOG_ID_ERROR, Strings.LINK_DIALOG_TITLE, $projectContainer);
            $(".pgb-project-radio").click(function (e) {
                eve("pgb.radio.click", null, $(e.target).attr("value"));
            });
        });
    });
});
