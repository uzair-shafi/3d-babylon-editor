import React, { RefObject } from 'react';
import { Scene } from '@babylonjs/core';
import { Copy, Trash2 } from 'lucide-react';
type ContextMenuProps = {
    contextMenu: { visible: boolean; x: number; y: number };
    setContextMenu: React.Dispatch<React.SetStateAction<{ visible: boolean; x: number; y: number }>>;
    sceneRef: RefObject<Scene | null>;
    selectedMeshRef: RefObject<any>;
    modelMapRef: RefObject<Map<string, any[]>>;
    gizmoManagerRef: RefObject<any>;
    duplicateModel: Function;
    removeSelectedModel: Function;
    makeModelSelected: (mesh: any) => void;
};

const ContextMenu: React.FC<ContextMenuProps> = ({
    contextMenu,
    setContextMenu,
    sceneRef,
    selectedMeshRef,
    modelMapRef,
    duplicateModel,
    removeSelectedModel,
    makeModelSelected
}) => {
    if (!contextMenu.visible) return null;

    const itemStyle: React.CSSProperties = {
        padding: "8px 10px",
        marginBottom: "4px",
        borderRadius: "6px",
        marginTop: "0px",
        transition: "background-color 0.2s ease",
    };

    return (
        <div
            style={{
                position: 'absolute',
                top: contextMenu.y,
                left: contextMenu.x,
                background: '#262626',
                color: '#c5c5c5ff',
                border: '1px solid #383838ff',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.26)',
                paddingLeft: '8px',
                paddingTop: '10px',
                paddingRight: '8px',
                paddingBottom: '8px',
                borderRadius: '6px',
                zIndex: 1000,
                userSelect: 'none',
                minWidth: '140px',
            }}
        >
            <div
                style={{ cursor: 'pointer' }}
                onClick={() => {
                    setContextMenu({ visible: false, x: 0, y: 0 });

                    const selected = selectedMeshRef.current;
                    if (!selected) return;
                    const scene = sceneRef.current;
                    if (!scene) return;

                    duplicateModel(selected, scene, (newRootName: string, newMeshes: any[]) => {
                        modelMapRef.current.set(newRootName, newMeshes);
                        const root = scene.getMeshByName(newRootName);
                        if (root) {
                            makeModelSelected(root);
                        }
                    });
                }}
            >
                <p
                    style={{
                        ...itemStyle, display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#3a3a3a')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                    Duplicate Model
                    <Copy size={16} />
                </p>
            </div>

            <div style={{ cursor: 'pointer', color: '#ff4d4f' }}
                onClick={() => {
                    setContextMenu({ visible: false, x: 0, y: 0 });
                    removeSelectedModel();
                }}
            >
                <p
                    style={{
                        ...itemStyle,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '26px',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#3a3a3a')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                    Remove Model
                    <Trash2 size={16} />
                </p>

            </div>
        </div>
    );
};

export default ContextMenu;
