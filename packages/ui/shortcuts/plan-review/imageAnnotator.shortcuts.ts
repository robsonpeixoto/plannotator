import { defineShortcutScope } from '../core';
import { createShortcutScopeHook } from '../runtime';

export const imageAnnotatorShortcuts = defineShortcutScope({
  id: 'image-annotator',
  title: 'Image Annotator',
  shortcuts: {
    penTool: {
      description: 'Pen tool',
      bindings: ['1'],
      section: 'Image Annotator',
      displayOrder: 10,
    },
    arrowTool: {
      description: 'Arrow tool',
      bindings: ['2'],
      section: 'Image Annotator',
      displayOrder: 20,
    },
    circleTool: {
      description: 'Circle tool',
      bindings: ['3'],
      section: 'Image Annotator',
      displayOrder: 30,
    },
    undo: {
      description: 'Undo',
      bindings: ['Mod+Z'],
      section: 'Image Annotator',
      displayOrder: 40,
    },
    save: {
      description: 'Save and close annotator',
      bindings: ['Enter', 'Escape'],
      section: 'Image Annotator',
      hint: 'Escape blurs the image name field first when it is focused.',
      displayOrder: 50,
    },
    confirmName: {
      description: 'Confirm image name',
      bindings: ['Enter'],
      section: 'Image Annotator',
      hint: 'Available while the image name field is focused.',
      displayOrder: 60,
    },
  },
});

export const useImageAnnotatorShortcuts = createShortcutScopeHook(imageAnnotatorShortcuts);
