define([
  'underscore',
  'marionette',
  'msgbus',
  'bundle/editor/views/translation_item',
  'bundle/editor/views/translations_empty',
  'tpl!bundle/editor/templates/translations_list',
], function(_, Marionette, msgbus, TranslationView, TranslationsEmptyView, translationsListTpl) {

  var TranslationListView = Marionette.CompositeView.extend({
    template: translationsListTpl,
    itemView: TranslationView,
    emptyView: TranslationsEmptyView,
    itemViewContainer: 'ul',
    className: 'x-editor--translations-list',

    collectionEvents: {
      'select:one': 'adjustPosition',
      'request': 'loading',
      'sync': 'render',
    },

    initialize: function() {
      _.bindAll(this, 'onKeydown');
      $(document).on('keydown', this.onKeydown);
    },

    // override remove to also unbind events
    remove: function() {
      $(document).off('keydown', this.onKeydown);

      Backbone.View.prototype.remove.call(this);
    },

    // Display a loading animation
    loading: function(target) {
      // Ensure the request event comes from collection and not one of its models
      // (because of event bubbling)
      if (target && target !== this.collection) {
        return;
      }

      this.$el.addClass('loading');
    },

    // Overwrite render method to stop loading animation
    render: function(target) {
      if (target && target !== this.collection) {
        return;
      }

      this.$el.removeClass('loading');
      Marionette.CompositeView.prototype.render.call(this);
      return this;
    },

    // Scrollable behaviour
    onRender: function() {
      var $window = $(window);
      var $el = this.$el.find('.js-scrollable');
      var updateBlockHeight = function UpdateBlockHeight() {
        $el.each(function() {
          var $this = $(this);
          var height = $window.height() - $this.offset().top;
          $this.height(height);
        });
      }

      setTimeout(function() { updateBlockHeight(); }, 200);
      $window.resize(updateBlockHeight);
    },

    onKeydown: function(evt) {
      if (window.event) {
        key = window.event.keyCode;
        isShift = window.event.shiftKey;
        isCtrl = window.event.ctrlKey;
      } else {
        key = evt.which;
        isShift = evt.shiftKey;
        isCtrl = evt.ctrlKey;
      }

      // If pressed TAB key
      if (key === 9) {
        evt.preventDefault();

        // var translation = this.collection.selectedItem;
        // if (null !== translation && translation.get('is_dirty'))
        //   translation.save({is_translated: true});

        if (isShift)
          msgbus.events.trigger('editor:previous');
        else
          msgbus.events.trigger('editor:next');
      }

      return;

      // If pressed ENTER key
      // if (key === 13 && isCtrl) {
      //   evt.preventDefault();

      //   var translation = this.collection.selectedItem;
      //   if (null === translation)
      //     return;

      //   if (isShift)
      //     translation.save({
      //       is_translated: true,
      //       is_approved: true
      //     });
      //   else
      //     translation.save({
      //       is_translated: true,
      //     });

      //   this.collection.selectNextItem();
      // }
    },

    adjustPosition: function() {
      var selectedTranslation = this.collection.selected;
      if (!selectedTranslation)
        return;

      var $translationList = this.$el.find('.js-scrollable');
      var $selectedTranslation = this.children.findByModel(selectedTranslation).$el;

      var docViewTop = $translationList.offset().top;
      var docViewBottom = docViewTop + $translationList.height();

      var elemTop = $selectedTranslation.offset().top;
      var elemBottom = elemTop + $selectedTranslation.height();

      if (!(elemBottom <= docViewBottom && elemTop >= docViewTop)) {
        var scrollTop = elemTop - docViewTop + $translationList.scrollTop() - $translationList.height() / 2 + 100;

        $translationList.animate({
          scrollTop: scrollTop
        }, 200);
      }
    }
  });

  return TranslationListView;
})
