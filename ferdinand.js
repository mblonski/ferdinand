
/*global Backbone, _, $, UIB, Drupal, console */

(function(root) {

  'use strict';


	var Ferdinand = {

		debug : true,

		settings: {},

		get: function(path, callback) {
			$.getJSON(Drupal.settings.basePath + path, callback);
		},

		url : function(path, basePathOnly) {
			var base = Drupal.settings.basePath;

			if (!basePathOnly && Drupal.settings.languageCount > 1) {
				base = base + Drupal.settings.oapi18n.prefix;
			}

			if (base.substring(base.length - 1, base.length) !== '/') {
				base = base + '/';
			}
			if (path.substring(0, 1) === '/') {
				path = path.substring(1);
			}
			return base + path;
		}

	};

	/**
	 * Initializable prototype.
	 */
	Ferdinand.Initializable = {

		/**
		 * Bind all methods to this.
		 */
		init : function(options) {
			_.bindAll(this);
		},

		/**
		 * Call superconstructor.
		 */
		superinit : function(clazz) {
			var args = Array.prototype.slice.call(arguments, 1); // remove first argument (clazz)
			clazz.prototype.initialize.apply(this, args);
		}
	};

	/**
	 * Static context storage.
	 */
	Ferdinand.ContextStorage = function() {

		var ctx = { },

			storage = {

				/**
				 * Set context variable.
				 *
				 * @param String name - variable name
				 * @param Object value - variable value
				 */
				set : function(name, value) {
					ctx[name] = value;
				},

				/**
				 * Get context variable.
				 *
				 * @return Object
				 */
				get : function(name) {
					return ctx[name];
				},

				/**
				 * Only for debug purpose.
				 */
				context : function() {
					return JSON.parse(JSON.stringify(ctx));
				}
			};

		this.getContextStorage = function() {
			return storage;
		};

	};
	// argh, jslint didn't allow me to write this normally ;(
	Ferdinand.ContextStorage = new Ferdinand.ContextStorage();

	/**
	 * Composite object. Composite consist of object and its parent object, so every time
	 * when Composite instance is being created parent attribute has to be specified in
	 * options hash.
	 */
	Ferdinand.Composite = {

		/**
		 * This variable tell us that object is a composite (should have parent).
		 */
		isComposite : true,

		/**
		 * Composite parent.
		 */
		parentObject: null,

		/**
		 * Initialize composite hash.
		 */
		initComposite : function(options) {
			if (options && options.parent) {
				this.parent(options.parent);
			}
		},

		/**
		 * Set or get parent view - the one which is the owner of this specific instance.
		 */
		parent : function(parent) {
			if (parent) {
				this.parentObject = parent;
				return this;
			} else {
				return this.parentObject;
			}
		}
	};

	/**
	 * Simple logging mechanism.
	 */
	Ferdinand.Log = {

		/**
		 * @access private
		 */
		_message : function(args, fun) {
			args = Array.prototype.slice.call(args); // change arguments to array
			if (typeof console !== 'undefined' && Ferdinand.debug) {
				console[fun].apply(console, args);
			}
		},

		/**
		 * @access public
		 */
		dir : function() {
			this._message(arguments, 'dir');
		},

		/**
		 * @access public
		 */
		info : function() {
			this._message(arguments, 'info');
		},

		/**
		 * @access public
		 */
		warn : function() {
			this._message(arguments, 'warn');
		},

		/**
		 * @access public
		 */
		error : function() {
			this._message(arguments, 'error');
		}
	};

	/**
	 * This fixes jQuery delegate for element lookup, scoped to DOM elements within the
	 * current view together with root node. This method is 2x slower then standard one
	 * so it cannot be used globally for all queries, but in the case when you would like
	 * to match root from $el, then you should extend your view with this hash.
	 */
	Ferdinand.TreeSelector = {

		$ : function(selector) {
			return this.$el.filter(selector).add(this.$el.find(selector));
		}
	};

	/**
	 * This is abstract backbone model.
	 */
	Ferdinand.AbstractModel = Backbone.Model.extend({

		/**
		 * In-sync attributes (not modified).
		 */
		backups : { },

		/**
		 * Default model attributes.
		 */
		defaults : { },

		/**
		 * True or false depending on the information if any add request is being
		 * processed in this moment. Set to true before request is send to backend, and
		 * back to false when success or error comes back.
		 */
		processing : false,

		/**
		 * If set to true second request will be blocked,
		 * true by default.
		 */
		ignoreWhenProcessing : true,

		/**
		 * Model initializer.
		 *
		 * @class Abstract model
		 * @constructs
		 * @private
		 */
		initialize : function(attributes, options) {
			this.init(options);
			this.superinit(Backbone.Model, attributes, options);
			this.setBackups(attributes || { });
		},

		/**
		 * Set model's attribute value.
		 *
		 * @param data - attribute to set or attribute/value hash
		 * @param value - attribute value or null if data hash has been provided
		 * @param options - setter options
		 * @public
		 */
		set : function(data, value, options) {
			var attrs;
			Backbone.Model.prototype.set.call(this, data, value, options);
			if (_.isObject(data)) {
				attrs = data;
				options = value;
			} else {
				attrs = {};
				attrs[data] = value;
			}
			if ((options = options || { }).backups) {
				this.setBackups(_.extend(this.getBackups(), attrs));
			}
			return this;
		},

		/**
		 * Reset model to it's initial state (set data which is in-sync with backend).
		 *
		 * @public
		 */
		reset : function() {
			var unset = { },
				attr = null;
			for (attr in this.attributes) {
				if (typeof(this.backups[attr]) === 'undefined') {
					unset[attr] = true;
				}
			}
			this.set(unset, { unset : true });
			this.set(this.getBackups());
			return this;
		},

		/**
		 * Set backup attributes (data which is in-sync with backend).
		 *
		 * @param attributes - hash of in-sync attributes to save
		 * @public
		 */
		setBackups : function(attributes) {
			this.backups = _.clone(attributes);
		},

		/**
		 * Get backup attributes (data which is in-sync with backend).
		 *
		 * @return in-sync attributes
		 * @public
		 */
		getBackups : function() {
			return _.clone(this.backups);
		},

		/**
		 * Handle messages from response.
		 *
		 * @param response - HTTP response data containing messages array
		 * @public
		 */
		handleMessages : function(response) {
			var messages = (response = response || { }).messages;
			if (messages) {
				Ferdinand.Log.info("TODO: handle messages", messages);
			} else {
				Ferdinand.Log.warn("No messages in response");
			}
		},

		/**
		 * Function invoked for all Model's Ajax calls
		 *
		 * @param url - short eg. 'synchronize' if url has same base as model or full path for different paths
		 * @param options - array with options that can be passed to ajax() method of jQuery
		 * @public
		 */
		ajax : function(url, options) {

			var data = null;

			if (url.indexOf('/') === -1) {
				url = this.url() + '/' + url;
			}

			options = options || { };

			data = options.data;
			data = typeof(data) === 'string' ? data : JSON.stringify(data) || null;

			$.ajax(url, {
				type : options.type || 'PUT',
				async : options.async === undefined ? true : options.async,
				context : this,
				data : data,
				dataType : 'json',
				contentType : 'application/json',
				success : function(response) {
					this.handleMessages(response);
					if (options.success) {
						options.success(this, response);
					}
				},
				error : function(xhr) {
					this.handleMessages($.parseJSON(xhr.responseText));
					if (options.error) {
						options.error(this, xhr);
					}
				}
			});
		},

		/**
		 * Override fetch method. This method is required only to have two
		 * additional events fired called 'fetching' and 'fetched, so we can
		 * bind on event call to other method.
		 *
		 * @param options - fetching options
		 * @public
		 */
		fetch : function(options) {

			var self, success, error;

			this.trigger("fetching", this);

			self = this;
			options = options || { };
			success = options.success;
			error = options.error;

			options.success = function(model, response) {
				var data = self.parse(response);
				self.handleMessages(response);
				self.setBackups(data);

				self.trigger("fetched", model, data, response);

				if (success) {
					success(model, response);
				}
			};

			options.error = function(model, xhr) {
				self.handleMessages($.parseJSON(xhr.responseText) || { });
				self.trigger("fetcherror", model, xhr);
				if (error) {
					error(model, xhr);
				}
			};

			// call original fetch from prototype
			Backbone.Model.prototype.fetch.call(this, options);
		},

		/**
		 * Override save method to display messages.
		 */
		save : function(attributes, options) {

			var self = this,
				success = null,
				error = null;

			if (this.processing && this.ignoreWhenProcessing) {
				Ferdinand.Log.warn('Ignore operation. Other request still in progress.', this);
				return;
			}

			this.processing = true;
			this.trigger('processing', this, true);

			this.trigger("saving");

			options = options || { };
			success = options.success;
			error = options.error;

			options.success = function(model, response) {
				var data = self.parse(response);
				self.handleMessages(response);
				self.setBackups(data);
				self.processing = false;
				self.trigger('processing', self, false);
				self.trigger("saved", data);
				if (success) {
					success(model, response);
				}
			};

			options.error = function(model, xhr) {
				self.handleMessages($.parseJSON(xhr.responseText) || { });
				self.processing = false;
				self.trigger('processing', self, false);
				self.trigger("saveerror", model, xhr);
				if (error) {
					error(model, xhr);
				}
			};

			// call original fetch from prototype
			Backbone.Model.prototype.save.call(this, attributes, options);
		},

		/**
		 * Override destroy method to display messages
		 */
		destroy : function(options) {
			var self, success, error;

			this.trigger("deleting");

			self = this;
			options = options || { };
			success = options.success;
			error = options.error;

			options.success = function(model, response) {
				var data = self.parse(response);
				self.handleMessages(response);
				self.setBackups(data || { });
				self.trigger("deleted", data);
				if (success) {
					success(model, response);
				}
			};

			options.error = function(model, response) {
				self.handleMessages($.parseJSON(response.responseText) || { });
				self.trigger("deleterror", model, response);
				if (error) {
					error(model, response);
				}
			};

			// call original destroy from prototype
			Backbone.Model.prototype.destroy.call(this, options);
		},

		/**
		 * Parse response. This will be called ONLY after HTTP 20x response
		 */
		parse: function(response, xhr) {
			if (!response) {
				Ferdinand.Log.error("Response cannot be undefined!");
				return;
			}
			return response.data || { };
		},

		/**
		 * This function will clear model attributes and automatically set
		 * default values, so when somone would like to purge model (wipe out all
		 * attributes and do not reset them to defaults), will have to use
		 * model.set({unset : true}) or Backbone.Model.prototype.clear.call(model)
		 */
		clear : function() {
			var args = Array.prototype.slice.call(arguments); // change arguments to array
			Backbone.Model.prototype.clear.apply(this, args);
			this.set(this.defaults);
			return this;
		}

	})
	.extend(Ferdinand.Initializable)
	.extend(Ferdinand.ContextStorage);

	/**
	 * Compositre model used when one model is a child of other one - no data
	 * relation - only logic and functional one.
	 */
	Ferdinand.CompositeModel = Ferdinand.AbstractModel.extend({

		/**
		 * Initialize composite model.
		 */
		initialize : function(attributes, options) {
			this.superinit(Ferdinand.AbstractModel, attributes, options);
			this.initComposite(options);
		},

		/**
		 * Copy parent attributes into this model.
		 */
		setFromParent : function() {
			this.set(this.parent().toJSON());
		}

	}).extend(Ferdinand.Composite).extend({

		/**
		 * Return parent or set new parent depending on the argument passed. It will
		 * use collection if available or this object as a parent child.
		 */
		parent : function(parent) {
			if (this.collection && this.collection.isComposite) {
				return this.collection.parent();
			} else {
				return Ferdinand.Composite.parent.call(this, parent);
			}
		}

	});

	/**
	 * This is new abstract view for all Backbone views we will be using.
	 */
	Ferdinand.AbstractView = Backbone.View.extend({

		tagName : 'none',

		el : null,

		validator : null,

		template : null,

		initialize : function(options) {

			this.init(options);
			this.initView(options);

			if ((options || { }).toggleable) {
				this.events = this.events || { };
				$.extend(this.events, {
					'click td[data-toggle="true"]': "onToggleableClick"
				});
			}
		},
		initView : function(options) {
			if (options) {
				if (options.el) {
					this.el = options.el;
				}
				if (options.template) {
					this.template = options.template;
				}
			}
			if (this.model && this.model instanceof Function) {
				this.model = new this.model();
				this.bindModel();
			}
			if (this.collection && this.collection instanceof Function) {
				this.collection = new this.collection();
			}
		},

		showTooltips: function() {
			if ($.fn.tooltip) {
				this.$('[title]').tooltip({
					delay    : 100,
					predelay : 100,
					offset   : [ -10, 0 ],
					tipClass : "ui-tooltip-bottom",
					events: {
						def: "mouseenter, blur mouseleave"
					}
				});
			} else {
				Ferdinand.Log.error("jQuery Tooltip plugin is missing!");
			}
		},

		setModel : function(model) {
			this.model = model;
		},

		bindModel : function() {
			Backbone.ModelBinding.bind(this);
			return this;
		},

		load : function() {
			this.model.fetch();
			return this;
		},

		validate: function() {
			var $form = this.$el.find('form');
			if ($form.length) {
				this.validator = $form.validate({
					errorPlacement: function(error, element){
						element.siblings('span').append(error);
					}
				});
				return $form.valid();
			} else {
				return true;
			}
		},

		render : function() {
			var html = null;

			if (!this.template || this.template.length === 0) {
				Ferdinand.Log.error('Template cannot be empty!');
				return;
			}

			html = this.template.render(this.model);

			// el <none> means that we haven't yet initialized DOM for this view and
			// therefore setElement() has to be used to create new [el, $el] pair from
			// rendered HTML

			if (this.el.nodeName === "NONE") {
				this.setElement(html);
			} else {
				this.$el.html(html);
			}

			this.bindModel();
			this.showTooltips();
			this.trigger("rendered");

			return this;
		},

		clear : function() {
			if (this.validator) {
				this.validator.resetForm();
			}
			if (this.isComposite) {
				this.model.parent().clear();
			}
			if (this.model && !(this.model instanceof Function)) {
				this.model.clear();
				this.bindModel();
			}
		},

		cancel : function() {
			if (this.validator) {
				this.validator.resetForm();
			}
			if (this.model && !(this.model instanceof Function)) {
				this.model.reset();
			}
		},

		onToggleableClick: function(e) {
			UIB.toggle($(e.currentTarget).parent().attr("data-toggle-id"));
		}

	})
	.extend(Ferdinand.Initializable)
	.extend(Ferdinand.ContextStorage);

	/**
	 * Tabs container view.
	 */
	Ferdinand.TabsContainerView = Ferdinand.AbstractView.extend({

		/**
		 * Are tabs loaded?
		 */
		loaded : false,

		/**
		 * Tabs definition.
		 */
		tabs : { },

		/**
		 * View created on the base of tabs definition.
		 */
		views : null,

		initialize : function(options) {
			this.superinit(Ferdinand.AbstractView, options);
			this.views = { };
			UIB.on("toggling", this.onToggle); // bind toggling event so we can build tabs on row expansion
		},

		onTabSelect : function(event, ui) {
			this.trigger("tabselect", event, ui);
		},

		/**
		 * Will be called when user press on + sign in X item row (row expansion).
		 *
		 * @param iid - X item IID
		 */
		onToggle : function(iid, type) {

			var tabid = null;

			// return if toggling not this view or user is closing X item
			if (iid !== this.model.cid || type !== "opening" || this.loaded) {
				return;
			}

			// construct and bind tabs
			this.$('.x-tabs').tabs({
				show : this.onTabSelect,
				selected : 0
			});

			// create views for all tabs
			for (tabid in this.tabs) {

				if (this.tabs.hasOwnProperty(tabid)) {

					// if tab prototype is undefined (unknown function)
					if (typeof(this.tabs[tabid]) !== 'undefined') {

						// create new tab view
						this.views[tabid] = new this.tabs[tabid]({
							parent : this,
							tabid : tabid
						});

						this.trigger("tabcreated", this.views[tabid]);

					} else {
						Ferdinand.Log.error("Prototype for tab '" + tabid + "' is undefined");
					}
				}
			}

			// tabs are now loaded
			this.loaded = true;
			this.trigger("tabsloaded", this.views);
		},

		/**
		 * Render tabs container.
		 *
		 * @returns this object
		 */
		render : function() {
			if (!this.template || this.template.length === 0) {
				Ferdinand.Log.error('Template cannot be empty!');
				return;
			}
			this.setElement(this.template.render(this.model));
			this.bindModel();
			this.showTooltips();
			this.trigger("rendered");
			return this;
		}
	});

	/**
	 * Composite view.
	 */
	Ferdinand.CompositeView = Ferdinand.AbstractView.extend({

		initialize: function(options) {

			if (!options || !options.parent) {
				Ferdinand.Log.error("Composite parent is required for Ferdinand.CompositeView");
				return;
			}

			this.superinit(Ferdinand.AbstractView, options);
			this.initComposite(options);
		}

	}).extend(Ferdinand.Composite);

	/**
	 * Single tab view.
	 */
	Ferdinand.TabView = Ferdinand.AbstractView.extend({

		tabid : null,

		initialize: function(options) {

			if (!options || !options.parent) {
				Ferdinand.Log.error("Composite parent is required for Ferdinand.TabView");
				return;
			}

			this.superinit(Ferdinand.AbstractView, options);
			this.initComposite(options);
			this.initTab(options);

			// some tabs can have no model attached
			if (this.model) {

				// but if there is model it has to be composite
				if (!this.model.isComposite) {
					Ferdinand.Log.error("Ferdinand.TabView requires model to be composite");
					return;
				}

				// connect models (set parent-child relationship)
				this.model.parent(this.parent().model);
				this.model.on('fetched', this.onFetched);
			}

			// some have collection inside
			if (this.collection) {

				// and it also have to be composite
				if (!this.collection.isComposite) {
					Ferdinand.Log.error("Ferdinand.TabView requires collection to be composite");
					return;
				}

				this.collection.parent(this.parent().model);
				this.collection.on('fetched', this.onFetched);
			}
		},

		/**
		 * Initialize tab.
		 */
		initTab : function(options) {

			// each tab required tabid to be initialized correctly
			if (!options || !options.tabid) {
				Ferdinand.Log.error("Attribute 'tabid' is required in Ferdinand.TabView initialization");
				return;
			}
			this.tabid = options.tabid;

			// set element to tab panel
			this.setElement(this.parent().$(UIB.Tabs.getPanelSelector(this.tabid)));
		},

		/**
		 * Called after data is fetched.
		 *
		 * @param model - updated model
		 */
		onFetched : function(data) {
			this.render();
		},

		render : function() {
			if (!this.template || this.template.length === 0) {
				Ferdinand.Log.error('Template cannot be empty!');
				return;
			}
			this.$el.html(this.template.render(this.model || { })).show();
			if (this.model) {
				this.bindModel();
			}
			this.showTooltips();
			this.trigger("rendered");
			return this;
		}

	}).extend(Ferdinand.Composite);

	/**
	 * Abstract collection view.
	 */
	Ferdinand.AbstractCollectionView = Ferdinand.AbstractView.extend({

		view : null,

		subviews : null,

		rendered : false,

		initialize : function(options) {

			this.superinit(Ferdinand.AbstractView, options);

			// get sub views constructor
			this.view = options.view;

			// bind this view to the several collection events
			this.collection.on('add', this.add);
			this.collection.on('remove', this.remove);
			this.collection.on('reset', this.reset);

			this.subviews = [ ];

			this.render();
		},

		/**
		 * Handles add event
		 */
		add : function(item, collection, options) {
			var index = options.index,
				element,
				subview,
				view = new this.view({model : item, toggleable : true});

			if (!view.rendered) {
				view.render();
			}
			element = view.$el;

			// if index is defined that means that this function
			// was called as event handler for 'add' event on collection
			if (index !== undefined) {
				subview = this.subviews[index];
				if (subview && subview.el) {
					// this should be el (sic!) because $el would insert 11 (or more) new views
					// because $el.length == 11 and insertBefore would iterete through all of them
					element.insertBefore(subview.el);
				} else {
					// fallback if subview does NOT exist or does NOT contain el
					// then just apppend view at the end
					this.$el.append(element);
				}
				// array insert (splice works even if array is empty)
				this.subviews.splice(index, 0, view);
			} else {
				this.$el.append(element);
				this.subviews.push(view);
			}
		},

		remove : function(item, collection, options) {
			var index = options.index,
				subview;
			if (index !== undefined) {
				subview = this.subviews[index];
				if (subview) {
					subview.$el.remove();
					this.subviews.splice(index, 1); // array delete
				}
			}
		},

		reset : function(apis) {
			this.empty();
			this.addAllFromCollection();
		},

		addAllFromCollection : function() {
			var self = this;
			this.collection.each(function (item, index, list) {
				self.add(item, list, {});
			});
		},

		empty : function() {
			this.subviews = [];
			this.$el.empty();
			return this;
		},

		render : function() {
			this.empty();
			this.addAllFromCollection();
			this.rendered = true;
			return this;
		}

	});

	/**
	 * This is abstract application class to be used by all backbone
	 * applications.
	 */
	Ferdinand.Application = Backbone.Router.extend({

		name: 'default',

		routes: {
			'' : void(0)
		},

		initialize : function(options) {

			options = options || { };
			options.root = document.location.pathname + '/';

			this.getContextStorage().set('settings.' + this.name, options.settings || {});

			this.superinit(Backbone.Router, options);
			this.init(options);
		},

		/**
		 * Starts the application, causes main data fetch.
		 */
		run : function() {
			if (this.data) {
				this.data.fetch({
					success: this.onLoad,
					error: this.onLoadError
				});
				this.onRun();
			} else {
				Ferdinand.Log.error('Data property is empty inside "run" method. You need to add data property in child class');
			}
			return this;
		},

		/**
		 * Called after application run.
		 */
		onRun : function() {
			// do nothing
		},

		/**
		 * Called after data fetch success. Has to be overriden by child classes.
		 */
		onLoad : function () {
			Ferdinand.Log.warn('Method onLoad in Application has not been overriden');
		},

		onLoadError : function(model, xhr, options) {

			var app = this,
				butthash = { },
				response = $.parseJSON(xhr.responseText) || { },
				messages = response.messages;

			if (messages && messages.length > 0) {
				UIB.message(messages);
				return;
			}

			butthash[Drupal.t('Try again')] = function() {
				$(this).dialog( "close" );
				app.run();
			};
			butthash[Drupal.t('Cancel')] = function() {
				$(this).dialog( "close" );
			};
			UIB.message(Drupal.t('There was problem with loading data. Would you like to try again?'), { buttons : butthash, type : 'error' });
		}

	})
	.extend(Ferdinand.Initializable)
	.extend(Ferdinand.ContextStorage);

	/**
	 * Abstract collection
	 */
	Ferdinand.AbstractCollection = Backbone.Collection.extend({

		/**
		 * Construct me.
		 */
		initialize : function(models, options) {
			this.superinit(Backbone.Collection, models, options);
			this.init();
		},

		/**
		 * Handle messages from response.
		 */
		handleMessages : function(response) {
			UIB.message(response.messages);
		},

		/**
		 * Override fetch method. This method is required only to have two
		 * additional events fired called 'fetching' and 'fetched, so we can
		 * bind on event call to other method.
		 */
		fetch : function(options) {

			var self, success, error;

			this.trigger("fetching", this);

			self = this;
			options = options || { };
			success = options.success;
			error = options.error;

			options.parse = false;

			options.success = function(collection, response) {
				self.handleMessages(response);
				self.trigger("fetched", collection, response);
				if (success) {
					success(collection, response);
				}
			};

			options.error = function(collection, response) {
				self.handleMessages($.parseJSON(response.responseText));
				self.trigger("fetcherror", collection);
				if (error) {
					error(collection, response);
				}
			};

			// call original fetch from prototype
			Backbone.Collection.prototype.fetch.call(this, options);
		},

		doFetch : function() {
			this.fetch({
				success : this.onPageLoad,
				error : this.onPageLoadError,
				parse : false
			});
		},

		/**
		 * Parse request and return collection elements.
		 */
		parse : function(response, xhr) {
			return response.data;
		},

		/**
		 * Build URL to get collection from.
		 */
		url: function() {
			return Ferdinand.url(this.endpoint);
		}

	})
	.extend(Ferdinand.Initializable)
	.extend(Ferdinand.ContextStorage);

	/**
	 * Composite collection.
	 */
	Ferdinand.CompositeCollection = Ferdinand.AbstractCollection.extend({

		initialize : function(models, options) {
			this.superinit(Ferdinand.AbstractCollection, models, options);
			this.initComposite(options);
		}

	}).extend(Ferdinand.Composite);

	/**
	 * Paged collection to be used when paging is required.
	 */
	Ferdinand.PagedCollection = Ferdinand.AbstractCollection.extend({

		/**
		 * Current page number.
		 */
		page : 1,

		/**
		 * Per page items limit.
		 */
		limit : 10,

		/**
		 * Total number of items.
		 */
		total : 0,

		/**
		 * Items filter.
		 */
		filter : "",

		/**
		 * Items sorted by.
		 */
		sortBy : "",

		/**
		 * Order - asc, desc.
		 */
		order : "asc",

		/**
		 * Construct me.
		 */
		initialize : function(options) {
			this.superinit(Ferdinand.AbstractCollection, options);
		},

		/**
		 * Build URL to get collection from.
		 */
		url: function(urlparams) {
			var param = null,
				params = {
					page : this.page,
					limit : this.limit,
					filter : $.param(this.filter),
					sortBy : this.sortBy,
					order : this.order
				};
			_.extend(params, this.urlparams || { }, urlparams || { });
			// remove empty params (we do not need to send them)
			for (param in params) {
				if (params[param] === "") {
					delete params[param];
				}
			}
			return Ferdinand.url(this.endpoint) + '?' + $.param(params);
		},

		/**
		 * Return page info.
		 */
		pageInfo : function() {

			var info, max, i;

			if (this.limit === 0) {
				this.limit = 10;
			}

			info = {
				total : this.total,
				page : this.page,
				limit : this.limit,
				pages : Math.ceil(this.total / this.limit),
				prev : false,
				next : false
			};

			max = Math.min(this.total, this.page * this.limit);

			if (this.total === this.pages * this.limit) {
				max = this.total;
			}

			info.range = [ (this.page - 1) * this.limit + 1, max ];
			if (this.page > 1) {
				info.prev = this.page - 1;
			}
			if (this.page < info.pages) {
				info.next = this.page + 1;
			}

			info.paging = [];

			if (info.pages === 0) {
				info.paging.push({ page : 1});
			} else {
				for (i = 1; i <= info.pages; i += 1) {
					info.paging.push({ page : i });
				}
			}

			return info;
		},

		/**
		 * Load next page.
		 */
		nextPage : function() {
			var info = this.pageInfo();
			if (this.page < info.pages) {
				this.page = this.page + 1;
				this.doFetch();
			} else {
				Ferdinand.Log.warn('This is last page');
			}
		},

		/**
		 * Load previous page.
		 */
		previousPage : function() {
			if (this.page > 1) {
				this.page = this.page - 1;
				this.doFetch();
			} else {
				Ferdinand.Log.warn('This is firs page');
			}
		},

		reloadPage : function() {
			this.doFetch();
		},

		loadPage : function(page) {
			this.page = page;
			this.doFetch();
		},

		onPageLoad : function(data) {
			Ferdinand.Log.info('Page ' + this.page + ' has been loaded');
			this.trigger('pageload', this.pageInfo());
		},

		onPageLoadError : function() {
			Ferdinand.Log.warn('Page ' + this.page + ' cannot be loaded');
			this.trigger('pageloaderror');
		},

		parse : function(resp) {
			Ferdinand.AbstractCollection.prototype.parse.call(this, resp);
			this.page = parseInt(resp.page, 10);
			this.limit = parseInt(resp.limit, 10);
			this.total = parseInt(resp.total, 10);
			return resp.data;
		}

	}).extend(Ferdinand.Initializable);

	/**
	 * Pager view.
	 */
	Ferdinand.PagerView = Ferdinand.AbstractView.extend({

		name : null,

		events : {
			'click a.prev-page' : 'previous',
			'click a.next-page' : 'next',
			'change select.pager-select' : 'gotoPage'
		},

		initialize : function(options) {

			this.superinit(Ferdinand.AbstractView, options);
			if (!options || !options.name) {
				Ferdinand.Log.error("Name attribute has to be specified");
				return;
			}

			this.name = options.name;

			// get paging template
			this.template = UIB.Paging.template();

			// bind to the paging changelimit event
			UIB.Paging.bind('changelimit', this.reset);

			// bind to the collection pageload event
			this.collection.bind('pageload', this.render);
		},

		reset : function(limit, name) {
			if (name !== this.name) {
				return;
			}
			this.collection.page = 1;
			this.collection.limit = limit;
			this.collection.reloadPage();
		},

		/**
		 * Render view.
		 */
		render : function() {

			// HTML element ID is hardcoded in UIB template, it will always be 'x-pager-links-xxx'
			// where xxx is ID attribute from input args, e.g. 'x-pager-links-apis'
			var element = $('.x-pager-links-' + this.name);

			if (!this.template || this.template.length === 0) {
				Ferdinand.Log.error('Template cannot be empty!');
				return;
			}

			element.html(this.template.render(this.collection.pageInfo()));
			$('.x-pager-options').change(function() {
				UIB.Paging.changeLimit($(this));
			});
			element.show();
			this.setElement(element);

			return this;
		},

		/**
		 * Load previous page.
		 */
		previous : function(event) {
			this.collection.previousPage();
		},

		/**
		 * Load next page.
		 */
		next : function(event) {
			this.collection.nextPage();
		},

		/**
		 * Load specific page (will take page number from select value).
		 */
		gotoPage : function(event) {
			this.collection.loadPage(parseInt($(event.currentTarget).val(), 10));
		}

	});

	/**
	 * Generic abstract view used to wrap functionality responsible for adding new elements
	 * to the backend and wrap it in collection.
	 *
	 * Warning!!!
	 * This view does NOT contain header with '+' button
	 * It contains only details!
	 */
	Ferdinand.AdderView = Ferdinand.AbstractView.extend({

		el: null,

		/**
		 * Empty model which should be used to gather the data.
		 */
		model: null,

		/**
		 * Collection where model data should be stored.
		 */
		collection: null,

		/**
		 * Bind to buttons.
		 */
		defaultevents : {
			'click .add-new-button' : 'add',
			'click .clear-new-button' : 'clear'
		},

		modelDefaults: null,

		/**
		 * Determines if template is already rendered in dom and we only need to
		 * assign view to it, if set to false temlate will be rendered and added to dom
		 */
		prerenderedTemplate: true,

		/**
		 * Initialize view.
		 *
		 * @param hash options
		 */
		initialize : function(options) {

			var events = this.events || { },
				event = null;

			// add default events to events hash
			for (event in this.defaultevents) {
				if (this.defaultevents.hasOwnProperty(event)) {
					if (!events[event]) {
						events[event] = this.defaultevents[event];
					}
				}
			}

			// ensure events are set
			this.events = events;

			(options = options || { }).toggleable = true;

			this.superinit(Ferdinand.AbstractView, options);
			this.modelDefaults = this.model.getBackups();

			if (this.prerenderedTemplate) {
				this.showTooltips();
				this.bindModel();
			} else {
				this.render();
			}
		},

		/**
		 * Handle click on add button.
		 */
		add : function() {
			var self = this;
			if (!this.validate()) {
				return false;
			}

			this.model.save({ }, {

				success : function(model, response) {

					// adds new model to beggining of the collection
					self.collection.add(model.toJSON(), {at: 0});
					self.clear();
					self.bindModel();
				}
			});
		},

		clear : function() {
			this.model.clear().set(this.modelDefaults);
			if (this.validator) {
				this.validator.resetForm();
			}
		}

	});

	/**
	 * Sorting view.
	 */
	Ferdinand.SorterView = Ferdinand.AbstractView.extend({

		/**
		 * Collection to be sorted (on BE, not in memory).
		 */
		collection: null,

		/**
		 * events of SorterView
		 */
		events : {
			'click thead:first span.x-sort' : 'onSortClick'
		},

		/**
		 * Constructor.
		 */
		initialize : function(options) {
			this.superinit(Ferdinand.AbstractView, options);
			if (!options || !options.el) {
				Ferdinand.Log.error("El attribute has to be specified");
				return;
			}
		},

		/**
		 * Yeah, sort me!
		 */
		onSortClick : function(event) {

			var $target = $(event.target),
				tsd = $target.attr('sort-dir'), // temporary sort dir
				tsb = $target.attr('sort-by'), // temporary sort by
				order = tsd || 'asc',
				sortBy = tsb || 'name';

			if (!tsb) {
				return;
			}

			this.$('span[sort-by]').each(function(i, v) {
				v = $(v);
				if (v.attr('sort-by') === sortBy) {
					if (v.attr('sort-enabled')) {
						order = v.attr('sort-dir') === 'asc' ? 'desc' : 'asc';
					}
					v.attr('sort-dir', order);
					v.attr('sort-enabled', true);
				} else {
					v.removeAttr('sort-dir');
					v.removeAttr('sort-enabled');
				}
			});

			this.collection.page = 1;
			this.collection.sortBy = sortBy;
			this.collection.order = order;
			this.collection.doFetch();

		}

	});


	Ferdinand.AbstractFilterView = Ferdinand.AbstractView.extend({

		timerId : 0,

		initialize : function(options) {
			this.superinit(Ferdinand.AbstractView, options);
		},

		events : {
			'keyup :input' : 'doSearch',
			'change select' : 'doSearch',
			'click .button-filter-reset a' : 'doReset'
		},

		/**
		 * Execute search.
		 */
		doSearch : function() {

			var serialized = this.$('form').serializeArray(),
				collection = this.collection,
				filter = [ ];

			// remove unnecessary empty filter variables
			$.each(serialized, function(i, hash) {
				if (hash.value !== "") {
					filter.push(hash);
				}
			});

			clearTimeout(this.timerId);

			this.timerId = setTimeout(function() {
				collection.filter = filter;
				collection.page = 1;
				collection.doFetch();
			}, 500);
		},

		doReset : function() {
			this.$('form').get(0).reset();
			this.doSearch();
		}

	});

	// export global vars
	root.Ferdinand = Ferdinand;

	//allow usage of raw javascript inside templates
	$.views.allowCode = true;

}(window));
