define([
  'underscore',
  'backbone',
  'marionette',
  'msgbus',

  'bundle/editor/models/context',
  'bundle/editor/models/filter_bag',

  'bundle/editor/views/actionbar',
  'bundle/editor/views/filters',
  'bundle/editor/views/layout',
  'bundle/editor/views/language_overlay',
  'bundle/editor/views/locale_chooser',
  'bundle/editor/views/resources_list',
  'bundle/editor/views/stats',
  'bundle/editor/views/translate/layout',
  'bundle/editor/views/translate/edit',
  'bundle/editor/views/translations_list',
  'bundle/editor/views/translate/tabs',
  'bundle/editor/views/translate/information_tab',

  'entities/language/collection',
  'entities/resource/collection',
  'entities/translation_commit/collection',
], function(
  _,
  Backbone,
  Marionette,
  msgbus,

  Context,
  FilterBag,

  ActionBarView,
  FiltersView,
  Layout,
  LanguageOverlayView,
  LocaleChooserView,
  ResourcesListView,
  StatsView,
  TranslationTranslateView,
  TranslationEditView,
  TranslationsListView,
  TranslateTabsView,
  TranslateInformationTabView,

  LanguagesList,
  ResourcesList,
  TranslationsList
) {

  //
  // Editor Application
  //

  // TODO:
  // [x] init context (source, target, filters (= resource + search + translated...) + mode (translate/approve))
  // [x] resourcesList = new
  // [x] translationsList = new
  // [x] show layout (<- project layout)
  // [x] layout.show(resourceListView)
  // [x] layout.show(new sourceLocaleListView(model: context))
  // [x] layout.show(new targetLocaleListView(model: context))
  // [x] layout.show(filterFormView)
  // [x] on context change, translationsList.fetch
  // [x] on translationsList select one,
  //   layout.show(translationTranslateView)
  //   + layout.show(translationHistoryView) + other tabs
  //   + layout.show(translationActionBar)
  //   + layout.show(translationEditTabs)
  // select next ???? event?

  function EditorApp(projectSlug) {
    this.projectSlug = projectSlug;
  }

  _.extend(EditorApp.prototype, Backbone.Events, {
    //
    // Initialize the Editor application.
    // This will have a direct impact on main app layout.
    //
    initialize: function(regionContainer) {
      this._initModels();
      this._initViews(regionContainer);
      this._initEvents();

      return this;
    },

    //
    // Remove the current Editor from the application layout.
    // Be sure to free all the initialized listeners.
    //
    destroy: function() {
      this.stopListening();
      this.layout.close();
      this.projectSlug = null;

      return this;
    },

    setMode: function(mode) {
      // TODO
    },

    //
    // Init models used by the Editor
    //
    _initModels: function() {
      // instanciate models
      this.context = new Context();
      this.filters = new FilterBag();
      this.translationId = null;

      this.resourcesList = new ResourcesList([], {
        projectSlug: this.projectSlug
      });

      this.languagesList = new LanguagesList([], {
        projectSlug: this.projectSlug
      });

      this.translationsList = new TranslationsList([], {
        projectSlug: this.projectSlug,
        context: this.context,
        filters: this.filters
      });

      // sync models
      this.languagesList.fetch();
      this.resourcesList.fetch();
    },


    //
    // Render the Editor layout.
    //
    _initViews: function(regionContainer) {
      this.layout = new Layout();
      regionContainer.show(this.layout);

      // instanciate views
      var sourceChooserView = new LocaleChooserView({
        contextAttribute: 'source',
        context: this.context,
        languagesList: this.languagesList
      });
      var targetChooserView = new LocaleChooserView({
        contextAttribute: 'target',
        context: this.context,
        languagesList: this.languagesList
      });
      var languageOverlayView = new LanguageOverlayView({
        model: this.context
      });
      var resourcesListView = new ResourcesListView({
        collection: this.resourcesList
      });
      var filtersView = new FiltersView({
        model: this.filters
      });
      var stastsView = new StatsView({
        translationsList: this.translationsList,
        filters: this.filters
      })
      var translationsListView = new TranslationsListView({
        collection: this.translationsList
      });

      // render views
      this.layout.languageOverlayRegion.show(languageOverlayView);
      this.layout.filtersRegion.show(filtersView);
      this.layout.sourceChooserRegion.show(sourceChooserView);
      this.layout.targetChooserRegion.show(targetChooserView);
      this.layout.resourcesListRegion.show(resourcesListView);
      this.layout.translationsListRegion.show(translationsListView);
      this.layout.statsRegion.show(stastsView);
    },

    //
    // Start events listener.
    //
    _initEvents: function() {
      // Local models events
      this.listenTo(this.context, 'change', this.updateTranslations);
      this.listenTo(this.context, 'change', this.updateRoute);
      this.listenTo(this.filters, 'change', this.updateTranslations);
      this.listenTo(this.filters, 'change', this.updateRoute);
      this.listenTo(this.translationsList, 'select:one', this.showTranslation);
      this.listenTo(this.translationsList, 'select:one', this.updateRoute);

      // Global events (namespaced)
      this.listenTo(msgbus.events, 'editor:previous', this.selectPreviousTranslation);
      this.listenTo(msgbus.events, 'editor:next', this.selectNextTranslation);
    },

    //
    // Update the route based on the context, selected translation and filters
    //
    updateRoute: function() {
      var path = ['projects', this.projectSlug, 'translate'];

      var parts = [
        this.context.get('source'),
        this.context.get('target'),
        this.translationId
      ];

      for (var i in parts) {
        var part = parts[i];
        if (part) {
          path.push(part);
        } else {
          break;
        }
      }

      var params = {};
      var filters = this.filters.toJSON();

      // Build query params
      for (var name in filters) {
        var value = filters[name];
        if (null !== value) {
          params[name] = value;
        }
      }

      // Build full URL
      var url = path.join('/');
      if (Object.keys(params).length > 0) {
        url += '?' + $.param(params);
      }

      // Navigate "silently" to the given URL
      Backbone.history.navigate(url, {replace: true});
    },

    //
    // Update the translations list when the context of the Editor changes.
    //
    updateTranslations: function() {
      var _this = this;

      if (!this.context.get('source') || !this.context.get('target')) {
        this.translationsList.reset();
        this.layout.actionBarRegion.close();
        this.layout.translationEditRegion.close();
        return;
      }

      this.translationsList.fetch().done(function() {
        if (!_this.translationId) {
          msgbus.events.trigger('editor:next');
          return;
        }

        var translation = _this.translationsList.get(_this.translationId);
        if (!translation && _this.translationsList.length > 0) {
          // If given translation is not found on current list, then select first one
          translation = _this.translationsList.at(0);
        }
        if (translation) {
          translation.select();
        }
      });
    },

    //
    // Render the views for the selected translation.
    //
    showTranslation: function(translation) {
      this.translationId = translation.id;

      var actionBarView = new ActionBarView({model: translation});
      var translationTranslateView = new TranslationTranslateView();
      var translationEditView = new TranslationEditView({model: translation});
      var tabsView = new TranslateTabsView();
      var informationTabView = new TranslateInformationTabView({model: translation});

      this.layout.actionBarRegion.show(actionBarView);
      this.layout.translationEditRegion.show(translationTranslateView);
      translationTranslateView.editRegion.show(translationEditView);
      translationTranslateView.tabsRegion.show(tabsView);
      translationTranslateView.informationTabRegion.show(informationTabView);

      if (!translation.get('edited')) {
        translation.fetch();
      }
    },

    //
    // Select the preivous translation of the list
    //
    selectPreviousTranslation: function() {
      var selectedTranslation = this.translationsList.selected;
      var previousTranslation = null;

      // If no translation is currently selected, then select the first one (if any)
      if (!selectedTranslation && this.translationsList.length > 0) {
        previousTranslation = this.translationsList.at(0);
      } else {
        previousTranslation = this.translationsList.at(this.translationsList.indexOf(selectedTranslation) - 1)
      }

      if (previousTranslation) {
        previousTranslation.select();
      }
    },

    //
    // Select the next translation of the list
    //
    selectNextTranslation: function() {
      var selectedTranslation = this.translationsList.selected;
      var nextTranslation = null;

      // If no translation is currently selected, then select the first one (if any)
      if (!selectedTranslation && this.translationsList.length > 0) {
        nextTranslation = this.translationsList.at(0);
      } else {
        nextTranslation = this.translationsList.at(this.translationsList.indexOf(selectedTranslation) + 1)
      }

      if (nextTranslation) {
        nextTranslation.select();
      }
    },

  });

  return EditorApp;
});
