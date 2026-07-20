interface TreeNode { name: string; path?: string; children?: TreeNode[] }

/** The shared sidebar-toggle glyph: a panel with a divided-off column. Used here
    and in the docs-sidebar SocialIcons override so both toggles read identically. */
const PanelIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <line x1="9.5" y1="4" x2="9.5" y2="20" />
  </svg>
);

function Nodes({ nodes, activePath, onSelect, depth }: {
  nodes: TreeNode[]; activePath: string; onSelect: (p: string) => void; depth: number;
}) {
  const indent = (d: number) => ({ paddingInlineStart: `${0.5 + d * 0.85}rem` });
  return (
    <>
      {nodes.map((node) =>
        node.path ? (
          <button
            key={node.path}
            type="button"
            className={`rcp-file${node.path === activePath ? ' rcp-file-active' : ''}`}
            style={indent(depth)}
            aria-current={node.path === activePath ? 'true' : undefined}
            onClick={() => onSelect(node.path!)}
          >
            {node.name}
          </button>
        ) : (
          <div key={node.name}>
            <div className="rcp-folder" style={indent(depth)}>{node.name}/</div>
            <Nodes nodes={node.children ?? []} activePath={activePath} onSelect={onSelect} depth={depth + 1} />
          </div>
        )
      )}
    </>
  );
}

export default function FileTree({
  tree, activePath, onSelect, collapsed, onToggle,
}: {
  tree: TreeNode[]; activePath: string; onSelect: (p: string) => void;
  collapsed: boolean; onToggle: () => void;
}) {
  if (collapsed) {
    return (
      <div className="rcp-tree rcp-tree-collapsed">
        <button type="button" className="rcp-tree-toggle" onClick={onToggle} aria-label="Show files" title="Show files">
          <PanelIcon />
        </button>
      </div>
    );
  }
  return (
    <div className="rcp-tree">
      <div className="rcp-tree-head">
        <span className="rcp-caption">Files</span>
      </div>
      <div className="rcp-tree-nodes">
        <Nodes nodes={tree} activePath={activePath} onSelect={onSelect} depth={0} />
      </div>
      <div className="rcp-tree-foot">
        <button type="button" className="rcp-tree-toggle" onClick={onToggle} aria-label="Hide files" title="Hide files">
          <PanelIcon />
        </button>
      </div>
    </div>
  );
}
