import Editor from '@monaco-editor/react';
import { useThemeStore } from '@/shared/store/theme';
import '@/shared/utils/monaco';

const FONT_SIZE = 13;
const TAB_SIZE = 2;
const SCROLLBAR_SIZE = 8;

interface MonacoEditorProps{
    value: string;
    language: string;
    ariaLabel: string;
    height?: string;
    isDisabled?: boolean;
    onChange: (value: string) => void;
}

const MonacoEditor = ({ value, language, ariaLabel, height = '28rem', isDisabled = false, onChange }: MonacoEditorProps) => {
    const theme = useThemeStore((state) => state.theme);

    return (
        <div className='overflow-hidden border border-border'>
            <Editor
                height={height}
                language={language}
                value={value}
                theme={theme === 'dark' ? 'vs-dark' : 'vs'}
                onChange={(next) => onChange(next ?? '')}
                options={{
                    ariaLabel,
                    readOnly: isDisabled,
                    domReadOnly: isDisabled,
                    fontSize: FONT_SIZE,
                    tabSize: TAB_SIZE,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    renderLineHighlight: 'none',
                    overviewRulerLanes: 0,
                    scrollbar: {
                        verticalScrollbarSize: SCROLLBAR_SIZE,
                        horizontalScrollbarSize: SCROLLBAR_SIZE
                    }
                }}
            />
        </div>
    );
};

export default MonacoEditor;
