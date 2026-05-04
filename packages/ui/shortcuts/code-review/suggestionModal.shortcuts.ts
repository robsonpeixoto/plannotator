import { defineShortcutScope } from '../core';
import { createShortcutScopeHook } from '../runtime';

export const reviewSuggestionModalShortcuts = defineShortcutScope({
  id: 'review-suggestion-modal',
  title: 'Suggestion Editor',
  shortcuts: {
    submit: {
      description: 'Submit suggestion',
      bindings: ['Mod+Enter'],
      section: 'Suggestion Editor',
      displayOrder: 10,
    },
    indent: {
      description: 'Indent (insert spaces)',
      bindings: ['Tab'],
      section: 'Suggestion Editor',
      displayOrder: 20,
    },
    cancel: {
      description: 'Close suggestion editor',
      bindings: ['Escape'],
      section: 'Suggestion Editor',
      displayOrder: 30,
    },
  },
});

export const useReviewSuggestionModalShortcuts = createShortcutScopeHook(reviewSuggestionModalShortcuts);
