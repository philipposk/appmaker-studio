import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import './CodeEditor.scss';

interface CodeEditorProps {
  app: any;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ app }) => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [code, setCode] = useState<string>('');

  const files = [
    ...(app.generatedCode?.frontend?.structure || []),
    ...(app.generatedCode?.backend?.structure || []),
  ];

  const handleFileSelect = (file: any) => {
    setSelectedFile(file.path);
    setCode(file.content || '');
  };

  const handleCodeChange = (value: string | undefined) => {
    if (value !== undefined) {
      setCode(value);
      // Could save to backend here
    }
  };

  const getLanguage = (path: string) => {
    if (path.endsWith('.jsx') || path.endsWith('.js')) return 'javascript';
    if (path.endsWith('.tsx') || path.endsWith('.ts')) return 'typescript';
    if (path.endsWith('.css') || path.endsWith('.scss')) return 'css';
    if (path.endsWith('.json')) return 'json';
    if (path.endsWith('.html')) return 'html';
    return 'plaintext';
  };

  return (
    <div className="code-editor">
      <div className="code-editor-layout">
        <div className="code-editor-sidebar">
          <div className="sidebar-header">
            <h3>Files</h3>
          </div>
          <div className="file-tree">
            <div className="file-tree-section">
              <h4>Frontend</h4>
              {app.generatedCode?.frontend?.structure?.map((file: any, index: number) => (
                <div
                  key={`frontend-${index}`}
                  className={`file-item ${selectedFile === file.path ? 'active' : ''}`}
                  onClick={() => handleFileSelect(file)}
                >
                  <span className="file-icon">📄</span>
                  <span className="file-name">{file.path}</span>
                </div>
              ))}
            </div>
            <div className="file-tree-section">
              <h4>Backend</h4>
              {app.generatedCode?.backend?.structure?.map((file: any, index: number) => (
                <div
                  key={`backend-${index}`}
                  className={`file-item ${selectedFile === file.path ? 'active' : ''}`}
                  onClick={() => handleFileSelect(file)}
                >
                  <span className="file-icon">📄</span>
                  <span className="file-name">{file.path}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="code-editor-main">
          {selectedFile ? (
            <>
              <div className="editor-header">
                <span className="file-path">{selectedFile}</span>
              </div>
              <Editor
                height="100%"
                language={getLanguage(selectedFile)}
                value={code}
                onChange={handleCodeChange}
                theme="vs-dark"
                options={{
                  minimap: { enabled: true },
                  fontSize: 14,
                  wordWrap: 'on',
                  automaticLayout: true,
                }}
              />
            </>
          ) : (
            <div className="code-editor-empty">
              <p>Select a file from the sidebar to view and edit code</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;

