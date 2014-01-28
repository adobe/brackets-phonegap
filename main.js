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

var brackets_phonegap_linked_project_Id = 0;
var brackets_phonegap_new_project = "";
var brackets_imbusy = 0;

define(function (require, exports, module) {
    "use strict";

	var Strings = require("js/strings");
    var ProjectListLinkTemplate = require("text!templates/project-link-list.html"),
        PanelTemplate = require("text!templates/panel.html"),
        ProjectListPanelTemplate = require("text!templates/project-panel-list.html"),
        ProjectNewTemplate = require("text!templates/new-project.html"),
        ProjectDeleteTemplate = require("text!templates/delete-project.html"),
        LoginTemplate = require("text!templates/login.html"),
        NativeApp = brackets.getModule("utils/NativeApp"),
        AppInit = brackets.getModule("utils/AppInit");

    
        //LoginTemplate       = require("text!templates/hardcodedlogin.html")
        
    var CommandManager = brackets.getModule("command/CommandManager"),
		ProjectManager = brackets.getModule("project/ProjectManager"),
		EditorManager  = brackets.getModule("editor/EditorManager"),
        Menus          = brackets.getModule("command/Menus"),
        Dialogs		   = brackets.getModule("widgets/Dialogs"),
        FileUtils      = brackets.getModule("file/FileUtils"),
        ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
        PanelManager   = brackets.getModule("view/PanelManager"),
		eve, base64, 
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
		            //res = (res == null || res == obj ? all : res) + "";
		            return res + "";
		        };
		    return function (str, obj) {
		        return String(str).replace(tokenRegex, function (all, key) {
		            return replacer(all, key, obj);
		        });
		    };
		})();

	require("js/widgets/bootstrap-alert");
	require("js/qrcode");
	require("js/jszip");
    require("js/widgets/bootstrap-tooltip");
    require("js/widgets/bootstrap-popover");

	//This seems wrong 
	require(["eve", "js/base64"], function (myeve, mybase64) {
		eve = myeve;
		base64 = mybase64;

	});

 	AppInit.appReady(function() {
		
		eve.f = function (event) {
			var attrs = [].slice.call(arguments, 1);
			return function () {
				eve.apply(null, [event, null].concat(attrs).concat([].slice.call(arguments, 0)));
			};
		};

		function zipProject(id) {
			var rootPath = ProjectManager.getProjectRoot().fullPath,
				files = [],
				txt = {txt: 1, html: 1, htm: 1, css: 1, svg: 1, xml: 1, js: 1},
				count = {
					c: 0,
					on: function () {
						this.c++;
					},
					off: function () {
						this.c--;
						!this.c && createZipFile(zip, id);
					}
				},
				zip = new JSZip;
			function getRelPath(root, path) {
				root = root.split("/");
				path = path.split("/");
				while (path[0] == root[0]) {
					path.splice(0, 1);
					root.splice(0, 1);
				}
				return new Array(root.length + 1).join("../") + path.join("/");
			}
			function processFile(path, data) {
				var ext = path.substring(path.lastIndexOf(".") + 1),
					isTxt = ext in txt;
					zip.file(
						path.substring(rootPath.length),
						data && (isTxt ? data : base64.encodeBinary(data)),
						{base64 : !isTxt}
					);
				count.off();
			}
			function readfile(path) {
				var xhr = new XMLHttpRequest;
				xhr.onload = function() {
					processFile(path, xhr.response);
				}
				xhr.overrideMimeType("text/plain; charset=x-user-defined");
				xhr.open("get", getRelPath(FileUtils.getNativeBracketsDirectoryPath(), path), false);
				xhr.send();
			}
			function readdir(path) {
				count.on();
				brackets.fs.readdir(path, function (err, filelist) {
					for (var i = 0; i < filelist.length; i++) {
						(function (fullFilename) {
							// Ignore files that start with a dot.
							var filename = fullFilename.substring(fullFilename.lastIndexOf("/") + 1, fullFilename.length);
							if (filename.charAt(0) == ".") {
								return;
							}
							count.on();
			                brackets.fs.stat(fullFilename, function (statErr, statData) {
			                    if (!statErr) {
			                        if (statData.isDirectory()) {
			                            readdir(fullFilename + "/");
			                        } else if (statData.isFile()) {
										count.on();
			                            readfile(fullFilename);
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
			brackets_imbusy = 1;
			if (!id) id = brackets_phonegap_linked_project_Id;
			$("#pgb-progress-" + id).val(0).css("visibility", "visible");
			zipProject(id);
		}

		function deleteApp(id) {
			var id = pendingDelete;
			var xhr = new XMLHttpRequest();
			xhr.open("DELETE", "https://build.phonegap.com/api/v1/apps/" + id + "?auth_token=" + token, true);
		 	xhr.setRequestHeader("Cache-Control", "no-cache");
		 	xhr.addEventListener("load", function() {eve("pgb.list"); pendingDelete = null;}, false);
		 	xhr.send();
		}

		function createZipFile(zip, id) {
	        var zipfile = zip.generate({"base64":false});
			var byteArray = new Uint8Array(zipfile.length);
            for (var i = 0; i < zipfile.length; i++) {
                byteArray[i] = zipfile.charCodeAt(i) & 0xff;
            }
            var blob = new Blob([byteArray.buffer], {"type":"application/zip"});
	        putZipFile(blob, id);
	    }

		function putZipFile(zipFile, id) {
			var xhr = new XMLHttpRequest();
			xhr.upload.addEventListener("loadstart", function (ev) {
				// NO-OP
			}, false);
			xhr.upload.addEventListener("progress", function (ev) {
				if (ev.lengthComputable) {
					$("#pgb-progress-" + id).val( Math.round((ev.loaded / ev.total) * 100) );
				}
			}, false);
			xhr.addEventListener("loadend", function (ev) { // Success or failure
				$("#pgb-progress-" + id).css("visibility", "hidden");
				toggleRebuildLabels(id);
				brackets_imbusy = 0;	
				eve("pgb.success.status", null, JSON.parse(this.responseText));
			}, false);
			xhr.upload.addEventListener("error", function (ev) {
				console.log("Zip file upload error", this, ev);
			}, false);


			if (typeof(id) === "number") {
				xhr.open("PUT", "https://build.phonegap.com/api/v1/apps/" + id + "?auth_token=" + token, true);
		        xhr.setRequestHeader("Cache-Control", "no-cache");
		        var form = new FormData();
		        form.append("file", zipFile, "file.zip");
		        xhr.send(form);
	    	} else {
	    		var urlToCall = "https://build.phonegap.com/api/v1/apps/?auth_token=" + token;
	    		xhr.open("POST", urlToCall , true);
		        xhr.setRequestHeader("Cache-Control", "no-cache");
		        var form = new FormData();
		        form.append("file", zipFile, "file.zip");
		        form.append("data", '{"title":"'+ id +'","create_method":"file", "hydrates":"true"}');
		        xhr.send(form);
	    	}	
		}
		
	    var PGB_COMMAND_ID = "phonegap.build";   // package-style naming to avoid collisions
	    CommandManager.register(Strings.COMMAND_NAME, PGB_COMMAND_ID, eve.f("pgb.button.click"));
	
		var button = $("<a>");		
		ExtensionUtils.loadStyleSheet(module, "css/pgb.css");
		
        var pgbhost = $('<div id="pgb-btn-holder"></div>');
        
		button.attr({
			title: Strings.COMMAND_NAME,
			id: "pgb-btn",
			href: "#",
			"class": "disabled"
		}).click(eve.f("pgb.button.click"));
        
        pgbhost.insertAfter("#toolbar-go-live");
        pgbhost.html(button);
        
        
        var m_opts_panel = {Strings: Strings};
        var $html_panel = $(Mustache.render(PanelTemplate, m_opts_panel));

		$(".close", $html_panel).click(eve.f("pgb.panel.close"));

        var $panel = PanelManager.createBottomPanel("brackets-phonegap", $html_panel, 200);

        var anim = $("#pgb-anim", $panel);

		var $tableContainer = $(".table-container", $panel),
			$projectContainer = $("<div>").attr("id", "pgb-link-container"),
			$newContainer = $("<div>").attr("id", "pgb-new-item-dialog-container"),
			panelOpened,
			token,
			linkedProjectId,
			pendingDelete,
            projects,
			platforms = ["ios", "android", "winphone", "blackberry", "webos", "symbian"];

		function ajax(url, name, type, username, password, showProgress) {
			if (showProgress) eve("pgb.status.progress");
			var fullUrl = "https://build.phonegap.com/" + url + (token ? "?auth_token=" + token : "");
            //console.log("full Url called:", fullUrl, "type:", type, "name:", name);
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

		/**
		 * Displays an alert box between the menu bar and the editor.
		 *
		 * @message     The text in the alert box. HTML tags are ok.
		 * @showButtons Whether or not to show the OK and Cancel buttons.
		 * @name        The name which will be used to invoke your callbacks: pgb.alert.<name>.ok and pgb.alert.<name>.cancel.
		 * @autoClose   Whether or not to automatically close this alert in 5 seconds.
		 */
		function showAlert(message, showButtons, name, autoClose) {
            var options = {
                    animation : true, 
                    html : true, 
                    placement : "left",
                    trigger : "click",
                    content : message
                };
                
                $("#pgb-btn-holder").popover(options);
                $("#pgb-btn-holder").popover("show");
                $("#pgb-btn-holder + .popover").css("top", "20px");
                $("#pgb-btn-holder + .popover .arrow").css("top", "40%");
                var doIt = function() {
                    $("#pgb-btn-holder").popover("destroy");
                }
                setTimeout(doIt, 5000);
            
		}

		function toggleRebuildLabels(id) {
			$("#rebuild-link-" + id).toggle();
			$("#rebuilding-text-" + id).toggle();
		}

		eve.on("pgb.status", function () {
			var type = eve.nt().split(/[\.\/]/)[2];
			button[0].className = type;
			anim[type == "progress" ? "show" : "hide" ]();
		});
		eve.on("pgb.login", function (login, password) {
			eve("pgb.anim");
			ajax("token", "login", "post", login, password, true);
		});
		eve.on("pgb.list", function () {
			ajax("api/v1/apps", "list", "get", null, null, true);
		});
		eve.on("pgb.projectinfo", function (id) {
			ajax("api/v1/apps/" + id, "projectinfo", "get", null, null, true);
		});
		eve.on("pgb.button.click", function () {
			if (!token) {
				eve("pgb.before.login");
			}
			eve("pgb.panel.open");
		});
		
		eve.on("pgb.before.login", function () {
            
            var m_opts = {Strings: Strings};
            var renderedTemplate = Mustache.render(LoginTemplate, m_opts);
            
            
			$(".pgb-table-container").append(renderedTemplate);
            var $form = $("#pgb-login-form");
			var inputs = $("input", $form);
			$form.on("submit", function (e) {
				e.preventDefault();
				eve("pgb.login", null, inputs[0].value, inputs[1].value);
				$("#pgb-login-form input[type=submit]").attr("disabled","disabled");
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
			Dialogs.showModalDialog(Dialogs.DIALOG_ID_ERROR, Strings.LOGIN_FAILED_DIALOG_TITLE, Strings.LOGIN_FAILED_DIALOG_MESSAGE);
			eve("pgb.status.error");
			$("#pgb-login-form input[type=submit]").removeAttr("disabled");
		});
		eve.on("pgb.success", function (json) {
			eve("pgb.status.normal");
		});

		var PGB_MENU_ID = "phonegap.build.menu";
	    var PGB_OPEN_COMMAND_ID = "phonegap.build.open";
		var PGB_LINK_COMMAND_ID = "phonegap.build.link";
		var PGB_BUILD_COMMAND_ID = "phonegap.build.build";
		var PGB_NEW_COMMAND_ID = "phonegap.build.new";

		eve.on("pgb.success.login", function (json) {
			token = json.token;

	      	var pgMenu = Menus.addMenu(Strings.MENU_NAME, PGB_MENU_ID);

		    CommandManager.register(Strings.OPEN_PANEL_MENU_ENTRY, PGB_OPEN_COMMAND_ID, eve.f("pgb.button.click"));
		    pgMenu.addMenuItem(PGB_OPEN_COMMAND_ID);

			CommandManager.register(Strings.LINK_PROJECT_MENU_ITEM, PGB_LINK_COMMAND_ID, eve.f("pgb.link"));
    	    pgMenu.addMenuItem(PGB_LINK_COMMAND_ID);

    	    CommandManager.register(Strings.NEW_PROJECT_OPTION, PGB_NEW_COMMAND_ID, eve.f("pgb.new"));
    	    pgMenu.addMenuItem(PGB_NEW_COMMAND_ID);

			CommandManager.register(Strings.SEND_FILES_MENU_ENTRY, PGB_BUILD_COMMAND_ID, eve.f("pgb.update.confirm"));
			
			pgMenu.addMenuItem(Menus.DIVIDER);
			pgMenu.addMenuItem(PGB_BUILD_COMMAND_ID);

			showAlert(Strings.LOGIN_SUCCESS_MESSAGE + Strings.LINK_PROJECT_MENU_ITEM, false, false);

			eve("pgb.status.normal");
			eve("pgb.list");
		});
		eve.on("pgb.success.list", function (json) {
			json.apps.sort(function (a,b) {if (a.title < b.title) return -1; if (a.title > b.title) return 1; return 0; });
            projects = json.apps;
            var projectsMassaged = [];
            
            
            for (var i = 0; i < projects.length; i++) {
                var app = projects[i];
                var appMassaged = {};

                if (app.icon.filename === null) {
                    appMassaged.iconlink = require.toUrl('./svg/icon-pg.svg');
                } else {
                    appMassaged.iconlink = "https://build.phonegap.com" + app.icon.link;
                }
                appMassaged.id = app.id;
                appMassaged.title = app.title;
                appMassaged.platforms = [];
                
                platforms.forEach(function(val, index) {
                    var platform = {};
                    platform.os = val;
                    platform.download = app.download[val];
                    if (app.status[val] === null) {
                        platform.status = "error";
                    } else {
                        platform.status = app.status[val];
                    }    
                    appMassaged.platforms.push(platform);
			     });
                projectsMassaged.push(appMassaged);
                
            }
            var m_opts_project_list = {Strings:Strings, projects: projectsMassaged};
            var html_project_list = Mustache.render(ProjectListPanelTemplate, m_opts_project_list);
            $(".pgb-table-container").html(html_project_list);
            $(".pgb-table-container").click(eve.f("pgb.click"));
            
            $(".project-link").click(function (e) {
                eve("pgb.url.open", null, $(e.target).attr("data-url"));
            });
		});
		eve.on("pgb.click", function (e) {
			console.log("pgb.click");
			console.log(e.target);
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
			}
			if (span.className.indexOf("pgb-rebuild") > -1) {
				eve("pgb.rebuild", null, span.getAttribute("data-id"));
			}

			if (span.className.indexOf("pgb-delete") > -1) {
				eve("pgb.delete", null, span.getAttribute("data-id"));
			} 
		});
		eve.on("pgb.success.projectinfo", function (json) {
			console.warn(2, json);
		});
		eve.on("pgb.rebuild", function (id) {
            console.log("Rebuild Called", "api/v1/apps/" + id, "rebuild");
			toggleRebuildLabels(id);
			ajax("api/v1/apps/" + id, "rebuild", "put", null, null, false);
		});
		eve.on("pgb.delete", function (id) {
			pendingDelete = id;
            var m_opts = {Strings: Strings, projects:projects, Dialogs: Dialogs};
            var renderedTemplate = Mustache.render(ProjectDeleteTemplate, m_opts);
			Dialogs.showModalDialogUsingTemplate(renderedTemplate).done(eve.f("pgb.alert.delete"));
		});
		eve.on("pgb.error.rebuild", function (error) {
			console.log("pgb.error.rebuild", error);
		});
		eve.on("pgb.success.rebuild", function (json) {
            console.log("pgb.success.rebuild", json);
			eve("pgb.success.status", null, json);
			showAlert(Strings.REBUILDING_SUCCESS_MESSAGE, false, null, true);
		});
		eve.on("pgb.failure.rebuild", function () {
			console.log("pgb.failure.rebuild");
		});
        eve.on("pgb.url.open", function(url) {
            NativeApp.openURLInDefaultBrowser(url);
 
        });
        eve.on("pgb.link", function() {
            var m_opts = {Strings: Strings, projects:projects, Dialogs: Dialogs};
            var renderedTemplate = Mustache.render(ProjectListLinkTemplate, m_opts);
			Dialogs.showModalDialogUsingTemplate(renderedTemplate).done(eve.f("pgb.close.link"));
        });
        eve.on("pgb.new", function() {
            var m_opts_new_project = {Strings:Strings, Dialogs: Dialogs};
            var html_new_project = Mustache.render(ProjectNewTemplate, m_opts_new_project);
			Dialogs.showModalDialogUsingTemplate(html_new_project).done(eve.f("pgb.close.new"));
        });
        eve.on("pgb.close.link", function(action) {
            console.log(brackets_phonegap_linked_project_Id);
        	if (action === Dialogs.DIALOG_BTN_OK) {
                showAlert(Strings.LINK_SUCCESSFUL_MESSAGE + Strings.SEND_FILES_MENU_ENTRY + ".", false, null, false);
			}
        });
         eve.on("pgb.close.new", function(action) {
            console.log(brackets_phonegap_new_project, action);
             
        	var val = brackets_phonegap_new_project;
        	if (action === Dialogs.DIALOG_BTN_CANCEL) {
        		// NO-OP. Probably don't have to do anything.
        	}
			else if (action === Dialogs.DIALOG_BTN_OK) {
				showAlert(Strings.NEW_ALERT_MESSAGE + " <em>" + val +  "</em>.", false, null, false);
				console.log("closed call on new, now doing updateApp");
				updateApp(val);
			}
        });
        eve.on("pgb.update.confirm", function() {
        	if(brackets_imbusy) {
        		showAlert("I'm currently doing a build", false, null, false);
        		return;
        	}
        	if (!brackets_phonegap_linked_project_Id) {
        		showAlert(Strings.PROJECT_NOT_LINKED_MESSAGE + Strings.LINK_PROJECT_MENU_ITEM, false, null, false);
        		return;
        	}
            var title = Strings.SEND_FILES_MENU_ENTRY;
            var message = Strings.UPLOAD_CONFIRMATION_MESSAGE;
            Dialogs.showModalDialog(Dialogs.DIALOG_ID_ERROR, title, message).done(eve.f("pgb.alert.bundle"));
        });
        eve.on("pgb.alert.bundle", function(action) {
            if (action === Dialogs.DIALOG_BTN_CANCEL) {
        		// NO-OP. Probably don't have to do anything.
        	}
			else if (action === Dialogs.DIALOG_BTN_OK) {
				updateApp();
			}
        });
        eve.on("pgb.alert.delete", function(action) {
            if (action === Dialogs.DIALOG_BTN_CANCEL) {
        		// NO-OP. Probably don't have to do anything.
        	}
			else if (action === Dialogs.DIALOG_BTN_OK) {
				deleteApp(pendingDelete);
			}
        	
        });
        eve.on("pgb.success.status", function(json) {
        	var finished = true,
        		status;

        	// Assoicate new projects with this folder
        	if (json.build_count == null){
        		brackets_phonegap_linked_project_Id = json.id;
        	}

        	for (var os in json.status) {
        		status = json.status[os];
        		if (status == "pending") finished = false;
        		$("#pgb-app-" + os + "-" + json.id).attr("class", "icon " + os + "-" + status);
        	}
        	if (finished) {
        		toggleRebuildLabels(json.id);
				showAlert(Strings.REBUILT_SUCCESS_MESSAGE, false, null, true);
				eve("pgb.list");
        	} else {
        		
        		var $rebuildingMsg = $("#rebuilding-text-" + json.id).html();

				if ($rebuildingMsg) {
					if ($("#rebuilding-text-" + json.id).css("display") == "none"){
						toggleRebuildLabels(json.id);
					}
					$("#rebuilding-text-" + json.id).html(
						($rebuildingMsg.length == Strings.REBUILDING_MESSAGE.length + 3) ? Strings.REBUILDING_MESSAGE : $rebuildingMsg + "."
					);
				}
				else{
					eve("pgb.list");
				}
        		setTimeout(function() {
        			ajax("api/v1/apps/" + json.id, "status", "get", null, null, false)
        		}, 3000);
        	}
        });
    });
});
