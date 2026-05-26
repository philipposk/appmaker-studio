import React, { useEffect, useRef } from 'react';
import grapesjs from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import 'grapesjs-preset-webpage';
import './VisualEditor.scss';

interface VisualEditorProps {
  app: any;
}

const VisualEditor: React.FC<VisualEditorProps> = ({ app }) => {
  const editorRef = useRef<any>(null);

  useEffect(() => {
    if (!editorRef.current) return;

    // Initialize GrapesJS
    const editor = grapesjs.init({
      container: editorRef.current,
      height: '100%',
      width: 'auto',
      storageManager: {
        type: 'local',
        autosave: true,
        autoload: true,
        stepsBeforeSave: 1,
        id: `gjs-${app._id}`
      },
      plugins: ['gjs-preset-webpage'],
      pluginsOpts: {
        'gjs-preset-webpage': {
          modalImportTitle: 'Import Template',
          modalImportLabel: '<div style="margin-bottom: 10px; font-size: 13px;">Paste here your HTML/CSS and click Import</div>',
          modalImportContent: (editor: any) => {
            return editor.getHtml() + '<style>' + editor.getCss() + '</style>';
          }
        }
      },
      canvas: {
        styles: [
          'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css'
        ]
      }
    });

    // Load existing HTML if available
    if (app.generatedCode?.frontend?.code) {
      editor.setComponents(app.generatedCode.frontend.code);
      editor.setStyle(app.generatedCode.frontend.code);
    }

    // Auto-save HTML changes
    editor.on('update', () => {
      const html = editor.getHtml();
      const css = editor.getCss();
      // Could save to backend here
    });

    return () => {
      editor.destroy();
    };
  }, [app._id, app.generatedCode]);

  return (
    <div className="visual-editor">
      <div className="visual-editor-toolbar">
        <h3>Visual HTML Editor</h3>
        <p>Drag and drop components to build your app visually</p>
      </div>
      <div ref={editorRef} className="gjs-editor" />
    </div>
  );
};

export default VisualEditor;

