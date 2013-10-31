ferdinand
=========

Ferdinand is a plugin for Backbone.js exposing missing framework structures.

Work in progress - nothing to see here!


## Example

```html
<html>
<head>
<script src="jquery.js"></script>
<script src="underscore.js"></script>
<script src="backbone.js"></script>

<script src="backbone.modelbinder.js"></script>
<script src="backbone.mutators.js"></script>
<script src="backbone.validation.js"></script>

<script src="jsrender.js"></script>
<script src="ferdinand.js"></script>

<script type="text/javascript">

$(document).ready(function(global) {

	var AdderView = Ferdinand.AbstractView.extend({
		el : "#add-view",
		collection : null,
		events : {
			"click input[name='add']" : "onAddClicked"
		},
		initialize : function(options) {
			this.superinit(Ferdinand.AbstractView, options);
			this.collection = options.collection;
		},
		onAddClicked : function(e) {
			var name = prompt("Tell me the job name");
			if (name) {
				this.collection.add(new Job({ name : name }));
			}
		}
	});
	
	// single job item
	var Job = Ferdinand.AbstractModel.extend({
		initialize : function(attributes, options) {
			this.superinit(Ferdinand.AbstractModel, attributes, options);
		}
	});
	
	// single job view
	var JobView = Ferdinand.AbstractView.extend({
		template : '#job-view-template',
		model : Job,
		events : {
			'click input[name=remove]' : 'onRemoveClicked'
		},
		// mapping from model attribute to HTML element selector
		bindings : {
			"name" : "span.job-name"
		},
		onRemoveClicked : function(event) {
			var ok = confirm("Are you sure to remove this job " + this.model.get('name')),
				jobs = this.model.collection;
			if (ok) {
				jobs.remove(this.model);
			}
		}
	});

	// jobs collection
	var JobsCollection = Ferdinand.AbstractCollection.extend({
		// single item prototype (model)
		model : Job
	});

	// view bound with jobs collection
	
	var JobsCollectionView = Ferdinand.AbstractCollectionView.extend({
		// the element bound with collection view
		el : "#jobs-view",
		// prototype of the single model view
		view : JobView,
		initialize : function(options) {
			this.superinit(Ferdinand.AbstractCollectionView, options);
		}
	});

	var jobs = new JobsCollection(),
		adder = new AdderView({ collection : jobs }),
		jobsView = new JobsCollectionView({ collection : jobs });

});

</script>

</head>
<body>

<div id="add-view">
<div class="weel" style="width: 400px; height: 50px; background-color: #f00">
<input type="button" value="Add" name="add"></input>
</div>
</div>

<!-- template for the single collection item view -->
<script id='job-view-template' type='text/x-jquery-tmpl'>
	<div>
		<span class='job-name'></span>
		<input type="button" name="remove" value="Remove"></input>
	</div>
</script>

<div id="jobs-view" style="width: 400px; background-color: #0f0"></div>

</body>
</html>
```
