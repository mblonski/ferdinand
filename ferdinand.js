/*global Backbone, _, $, console */

(function(root) {

	'use strict';

	if (typeof(String.prototype.endsWith) !== 'function') {
	    String.prototype.endsWith = function(suffix) {
	        return this.indexOf(suffix, this.length - suffix.length) !== -1;
	    };
	}

	// "test bubu {0} test {1}".format('foo', 'bar') => "test bubu foo test bar"
	if (typeof(String.prototype.format) !== 'function') {
		String.prototype.format = function(a) {
			var args = arguments;
			if (typeof(this) !== 'undefined') {
				return this.replace(/{(\d+)}/g, function(match, number) {
					return typeof(args[number]) !== 'undefined' ? args[number] : match;
				});
			}
		};
	}

	// min array value
	Array.prototype.min = function() {
		var min = this[0],
			i = 0;
		for (i = 1; i < this.length; i += 1) {
			if (this[i] < min) {
				min = this[i];
			}
		}
		return min;
	};

	// max array value
	Array.prototype.max = function() {
		var max = this[0],
			len = this.length,
			i = 0;
		for (i = 1; i < len; i++) {
			if (this[i] > max) {
				max = this[i];
			}
		}
		return max;
	};

	var Ferdinand = {

		debug : true,

		settings: { },

		basePath : "",

		get: function(path, callback) {
			$.getJSON(this.basePath + path, callback);
		},

		url : function(path, basePathOnly) {
			var base = this.basePath;

			if (base.substring(base.length - 1, base.length) !== '/') {
				base = base + '/';
			}
			if (path.substring(0, 1) === '/') {
				path = path.substring(1);
			}
			return base + path;
		},

		parse : function(response, options) {

			if (!response) {
				Ferdinand.Log.error("Response not found!", response);
				return;
			}

			options || (options = { });

			if (options.parser) {
				if (options.parser instanceof Function) {
					return options.parser(response, options);
				} else {
					Ferdinand.Log.error('Parser shall be a function instance', options.parser);
					return [ ];
				}
			}

			return response;
		},
		
		/**
		 * Handle messages from response.
		 */
		handleMessages : function(response) {

			if (typeof response === 'string') {
				try {
					//Prior to jQuery 1.9, $.parseJSON returned null instead of throwing an error if it was passed an
					//empty string, null, or undefined, even though those are not valid JSON.
					//Since we are using > 1.9 when exception handling must be added.
					response = $.parseJSON(response);
				} catch(e) {
					Ferdinand.Log.warn('Response does not contain a valid JSON string, hence empty object will be used', e);
				}
			}

			response = response || {};

			if (response.messages) {
				Ferdinand.Log.info("Received messages:", response.messages);
			}
			if (response.status) {
				Ferdinand.Log.info("Received status:", response.status);
			}
			if (response.error) {
				Ferdinand.Log.info("Received error message:", response.error);
			}
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
		 * This is the list of persistent model attributes, which means that if one 
		 * specify this property, only values matching the ones inside of it, will 
		 * be persisted to backend server. All other attributes will be simply ignored. 
		 */
		persistent : null,

		endpoint : null,

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

		url : function(options) {

			options || (options = { });

			var endpoint = options.endpoint || this.endpoint,
				endpointparams = null,
				endpointopts = null,
				slash = null,
				pfunname = null,
				pfun = null;

			if (endpoint) {

				if ($.isArray(endpoint)) {
					Ferdinand.Log.error('Incorrect endpoint hash - cannot be array!');
					return;
				}

				if (typeof(endpoint) === 'object') {
					endpointparams = endpoint.params;
					endpointopts = endpoint.opts;
					endpoint = endpoint.url;
				} else {
					endpointparams = options.endpointparams || this.endpointparams;
					endpointopts = options.endpointopts || this.endpointopts;
				}

				if (endpointparams) {
					for (var param in endpointparams) {
					    if (endpointparams.hasOwnProperty(param)) {

					    	pfunname = endpointparams[param];

					    	switch (typeof(pfunname)) {
					    		case 'undefined':
					    			Ferdinand.Log.error('Endpoint parameter "' + param + '" mapping is missing');
					    			return;
					    		case 'function':
					    			pfun = pfunname;
					    			break;
								default:
									pfun = this[pfunname];
							}

							if (typeof(pfun) === 'function') {
							    endpoint = endpoint.replace(':' + param, pfun.call(this, options));
							} else {
								Ferdinand.Log.error('Endpoint parameter "' + param + '" function ' + pfunname + ' is missing');
								return;
							}
					    }
					}
				}

				endpointopts || (endpointopts = { });

				if (this.isNew() || endpointopts.ignoreid) {
					return Ferdinand.url(endpoint);
				} else {
					slash = endpoint.endsWith('/') ? '' : '/';
					return Ferdinand.url(endpoint + slash + this.get(this.idAttribute));
				}
			} else {
				Ferdinand.Log.error('No endpoint specified for model');
			}
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
		 * Function invoked for all Model's Ajax calls
		 *
		 * @param url - short eg. 'synchronize' if url has same base as model or full path for different paths
		 * @param options - array with options that can be passed to ajax() method of jQuery
		 * @public
		 */
		ajax : function(url, options) {

			var data = null;

			if (url.indexOf('/') !== 0) {
				url = this.url() + '/' + url;
			}

			options || (options = { });

			data = options.data;
			data = typeof(data) === 'string' ? data : JSON.stringify(data) || null;

			$.ajax(url, {
				type : options.type || 'PUT',
				async : typeof(options.async) === 'undefined' ? true : options.async,
				context : this,
				data : data,
				dataType : options.dataType || 'json',
				contentType : options.contentType || 'application/json',
				success : function(response) {
					Ferdinand.handleMessages(response);
					if (options.success) {
						options.success(this, response);
					}
				},
				error : function(xhr) {
					Ferdinand.handleMessages(xhr.responseText);
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
				Ferdinand.handleMessages(response);
				self.setBackups(data);

				self.trigger("fetched", model, data, response);

				if (success) {
					success(model, response, options, data);
				}
			};

			options.error = function(model, xhr) {
				Ferdinand.handleMessages(xhr.responseText);
				self.trigger("fetcherror", model, xhr);
				if (error) {
					error(model, xhr, options);
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
				error = null,
				_response = null;

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

			options.success = function(model, response, options) {
				var data = self.parse(response);
				Ferdinand.handleMessages(response);
				self.setBackups(data);
				self.processing = false;
				self.trigger('processing', self, false);
				self.trigger("saved", data);
				if (success) {
					success(model, response, options, data);
				}
			};

			options.error = function(model, xhr, options) {
				Ferdinand.handleMessages(xhr.responseText);
				self.processing = false;
				self.trigger('processing', self, false);
				self.trigger("saveerror", model, xhr);
				if (error) {
					error(model, xhr, options);
				}
			};

			// in case when persistent fields are defined, we have to filter
			// attributes to be saved. we can do that by setting options.attrs, 
			// which will tell BB to override the default attributes set with the
			// one specified in options (please note that field name in options
			// must be set to "attrs", it won't work otherwise)
			
			if (this.persistent) {
				options.attrs = attributes = _.pick(_.isEmpty(attributes) ? this.toJSON() : attributes, this.persistent); 
			}
			
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
				Ferdinand.handleMessages(response);
				self.setBackups(data || { });
				self.trigger("deleted", data);
				if (success) {
					success(model, response);
				}
			};

			options.error = function(model, response) {
				Ferdinand.handleMessages(response.responseText);
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
		parse: Ferdinand.parse,

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
		 * Function invoked for all Model's Ajax calls
		 *
		 * @param url - short eg. 'synchronize' if url has same base as model or full path for different paths
		 * @param options - array with options that can be passed to ajax() method of jQuery
		 * @public
		 */
		ajax : function(url, options) {

			var data = null;

			if (url.indexOf('/') !== 0) {
				url = this.url() + '/' + url;
			}

			options || (options = { });

			data = options.data;
			data = typeof(data) === 'string' ? data : JSON.stringify(data) || null;

			$.ajax(url, {
				type : options.type || 'PUT',
				async : typeof(options.async) === 'undefined' ? true : options.async,
				context : this,
				data : data,
				dataType : options.dataType || 'json',
				contentType : options.contentType || 'application/json',
				success : function(response) {
					Ferdinand.handleMessages(response);
					if (options.success) {
						options.success(this, response);
					}
				},
				error : function(xhr) {
					Ferdinand.handleMessages(xhr.responseText);
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
		 */
		fetch : function(options) {

			var self, success, error;

			this.trigger("fetching", this);

			self = this;
			options = options || { };
			success = options.success;
			error = options.error;
			
			options.success = function(collection, response) {
				Ferdinand.handleMessages(response);
				self.trigger("fetched", collection, response);
				if (success) {
					success(collection, response);
				}
			};

			options.error = function(collection, response) {
				Ferdinand.handleMessages(response.responseText);
				self.trigger("fetcherror", collection);
				if (error) {
					error(collection, response);
				}
			};

			// call original fetch from prototype
			Backbone.Collection.prototype.fetch.call(this, options);
			
			return this;
		},

		doFetch : function() {
			this.fetch({
				success : this.onPageLoad,
				error : this.onPageLoadError
			});
		},

		/**
		 * Parse response. This will be called ONLY after HTTP 20x response
		 */
		parse: Ferdinand.parse,

		/**
		 * Build URL to get collection from.
		 */
		url: function(options) {

			options || (options = { });

			var endpoint = options.endpoint;

			var endpoint = options.endpoint || this.endpoint,
				endpointparams = null,
				endpointopts = null,
				pfunname = null,
				pfun = null;

			if (endpoint) {

				if ($.isArray(endpoint)) {
					Ferdinand.Log.error('Incorrect endpoint hash - cannot be array!');
					return;
				}

				if (typeof(endpoint) === 'object') {
					endpointparams = endpoint.params;
					endpointopts = endpoint.opts;
					endpoint = endpoint.url;
				} else {
					endpointparams = options.endpointparams || this.endpointparams;
					endpointopts = options.endpointopts || this.endpointopts;
				}

				if (endpointparams) {
					for (var param in endpointparams) {
					    if (endpointparams.hasOwnProperty(param)) {

					    	pfunname = endpointparams[param];

							switch (typeof(pfunname)) {
								case 'undefined':
									Ferdinand.Log.error('Endpoint parameter "' + param + '" mapping is missing in collection');
									return;
								case 'function':
									pfun = pfunname;
									break;
								default:
									pfun = this[pfunname];
							}

							if (typeof(pfun) === 'function') {
							    endpoint = endpoint.replace(':' + param, pfun.call(this, options));
							} else {
								Ferdinand.Log.error('Endpoint parameter "' + param + '" function ' + pfunname + ' is missing in collection');
								return;
							}
					    }
					}
				}

				return Ferdinand.url(endpoint);
			} else {
				Ferdinand.Log.error('No endpoint specified for collection');
			}
		}
	})
	.extend(Ferdinand.Initializable)
	.extend(Ferdinand.ContextStorage);


	/**
	 * This is new abstract view for all Backbone views we will be using.
	 */
	Ferdinand.AbstractView = Backbone.View.extend({

		tagName : 'none',

		el : null,

		/**
		 * @private
		 */
		validator : null,

		template : null,

		/**
		 * Binding definitions.
		 *
		 * @private
		 */
		bindings : null,

		/**
		 * Model binder.
		 *
		 * @private
		 */
		binder : null,

		initialize : function(options) {
			this.init(options);
			this.initView(options);
		},

		initView : function(options) {

			var model = this.model;
			
			if (options) {
				if (options.template) {
					this.template = options.template;
				}
				if (options.model) {
					model = options.model;
				}
				if (options.collection) {
					this.collection = options.collection;
				}
			}

			if (this.binder === null) {
				this.binder = new Backbone.ModelBinder();
			}

			if (model) {
				if (this.model) {
					this.unbindModel();
				}
				if (model instanceof Function) {
					model = new model();
				}
				this.model = model;
				this.bindModel();
			}

			if (this.collection && this.collection instanceof Function) {
				this.collection = new this.collection();
			}
			
			if (this.events) {
				
				var events = this.events || { };
				
				for (var key in events) {
					
					var method = events[key];
			        if (!_.isFunction(method)) {
			        	method = this[events[key]];
			        }
			        if (!method) {
			        	Ferdinand.Log.error("Event callback is not a function", events[key]);
			        	continue;
			        }

			        var match = key.match(/^(\S+)\s*(.*)$/),
			        	eventName = match[1],
			        	selector = match[2];
					
			        // this as selector means we must bind event to view
			        if (selector == "this") {
			        	this.unbind(eventName);
			        	this.bind(eventName, method);
			        }
				}
			}
		},

		setModel : function(model) {
			this.model = model;
		},

		isDomCreated : function() {
			return this.el.nodeName.toLowerCase() !== "none";
		},
		
		unbindModel : function() {
			if (this.isDomCreated()) {
				if (this.model.validation) {
					if (typeof(this.model.unbind) === "function") {
						this.model.unbind("validated:invalid");
					}
					Backbone.Validation.unbind(this);
				}
				this.binder.unbind();
				this.trigger("unbind", this.model);
			}
		},

		bindModel : function() {
			// element node name 'none' means that element has not yet been rendered
			if (this.isDomCreated()) {
				this.binder.bind(this.model, this.$el, this.bindings, { suppressThrows : true });
				this.trigger("bind", this.model);
				if (this.model.validation) {
					var view = this;
					Backbone.Validation.bind(this);
					this.model.bind("validated:invalid", function(model, errors) {
						view.trigger("validated:invalid", model, errors)
					});
				}
			}
			return this;
		},

		load : function() {
			this.model.fetch();
			return this;
		},

		render : function() {
			var html = null;

			if (typeof(this.template) === 'undefined') {
				Ferdinand.Log.error('View template cannot be undefined!');
				return;
			} else if (typeof(this.template) === 'string') {
				// convert selector to object
				this.template = $(this.template);
			}

			if (!this.template || this.template.length === 0) {
				Ferdinand.Log.error('Template cannot be empty!');
				return;
			}

			// as per jQuery 1.9, all HTML strings have to be worked thru
			// the $.parseHTML(..) function

			html = $.parseHTML(this.template.render(this.model));

			// el <none> means that we haven't yet initialized DOM for this view and
			// therefore setElement() has to be used to create new [el, $el] pair from
			// rendered HTML

			if (!this.isDomCreated()) {
				this.setElement(html);
			} else {
				this.$el.html(html);
			}

			this.bindModel();
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
		}

	})
	.extend(Ferdinand.Initializable)
	.extend(Ferdinand.ContextStorage);

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
	 * Abstract collection view.
	 */
	Ferdinand.AbstractCollectionView = Ferdinand.AbstractView.extend({

		view : null,

		subviews : null,

		rendered : false,

		initialize : function(options) {

			this.superinit(Ferdinand.AbstractView, options);

			// get sub views constructor
			if (options.view) {
				this.view = options.view;
			}
			if (!this.view) {
				Ferdinand.Log.error("Child view constructor has to be defined");
				return;
			}

			if (!this.collection) {
				Ferdinand.Log.error("Collection object for abstract collection view has to be set");
				return;
			}

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

			options || (options = { });

			var index = options.at,
				element = null,
				subview = null,
				view = new this.view({
					model : item,
					parent : this.isComposite ? this : null
				});

			if (!view.rendered) {
				view.render();
			}
			element = view.$el;

			// if index is defined that means that this function
			// was called as event handler for 'add' event on collection
			if (index !== undefined) {
				subview = this.subviews[index];
				if (subview && subview.el) {
					// this should be el (sic!) because $el would insert many new views
					// depending on $el.length and insertBefore would iterete through all of them
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

			options || (options = { });

			var index = options.index,
				subview = null;

			if (typeof(index) !== 'undefined') {
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
			
			if (!this.isDomCreated()) {
				Ferdinand.Log.error("Collection view element has not been found");
				return;
			}
			
			this.empty();
			this.addAllFromCollection();
			this.rendered = true;
			return this;
		}

	});


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
		filter : { },

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
		initialize : function(models, options) {
			this.superinit(Ferdinand.AbstractCollection, models, options);
		},

		/**
		 * Build URL to get collection from.
		 */
		url: function(urlparams) {
			var param = null,
				params = {
					page : this.page,
					limit : this.limit,
					filter : $.param(this.filter || {}),
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
				Ferdinand.Log.warn('This is first page');
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
			'change select.pager-select' : 'onPageChange',
			'change select.pager-options' : 'onLimitChange'
		},

		initialize : function(options) {

			this.superinit(Ferdinand.AbstractView, options);

			// bind to the collection pageload event
			this.collection.bind('pageload', this.updatePager);
			this.collection.bind('fetched', this.updatePager);
			
			this.render();
		},

		updatePager : function() {
			
			var info = this.collection.pageInfo(),
				$select = this.$('select.pager-select'),
				html = "",
				i = 0, p = 0;
			
			$select.empty();
			
			for (i = 0; i < info.paging.length; i++) {
				p = info.paging[i].page;
				html += "<option val='" + p + "'>" + p + "</option>";  
			}
			
			$select.html(html).val(info.page + 1);
		},
		
		render : function() {
			var html = null;

			if (typeof(this.template) === 'undefined') {
				Ferdinand.Log.error('Template for pager view must be specified!');
				return;
			} else if (typeof(this.template) === 'string') {
				// convert selector to object
				this.template = $(this.template);
			}

			if (!this.template || this.template.length === 0) {
				Ferdinand.Log.error('Template for pager view has not been found!');
				return;
			}

			// as per jQuery 1.9, all HTML strings have to be worked thru
			// the $.parseHTML(..) function

			html = $.parseHTML(this.template.render(this.collection.pageInfo()));

			// el <none> means that we haven't yet initialized DOM for this view and
			// therefore setElement() has to be used to create new [el, $el] pair from
			// rendered HTML

			if (!(this.el && this.el.nodeType)) {
				Ferdinand.Log.error("Pager view element (el param) has not been found");
				return;
			}
			
			if (this.el.nodeName === "NONE") {
				this.setElement(html);
			} else {
				this.$el.html(html);
			}

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
		onPageChange : function(event) {
			this.collection.loadPage(parseInt($(event.currentTarget).val(), 10));
		},

		/**
		 * Change limit (will take limit number from select value).
		 */
		onLimitChange :  function(event) {
			
			this.collection.limit = parseInt($(event.currentTarget).val(), 10);
			this.collection.loadPage(1);
			
			this.$('select.pager-options').val(this.collection.limit);
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
			}
			this.onRun();
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

	// export global vars
	root.Ferdinand = Ferdinand;

	//allow usage of raw javascript inside templates
	$.views.allowCode = true;

}(window));
