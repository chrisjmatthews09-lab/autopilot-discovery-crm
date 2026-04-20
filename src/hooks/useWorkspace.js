import { useLocation, useNavigate } from 'react-router-dom';
import { WORKSPACES, workspaceFromPath, otherWorkspace, DEFAULT_WORKSPACE } from '../config/workspaces';

export function useWorkspace() {
  const location = useLocation();
  const navigate = useNavigate();
  const id = workspaceFromPath(location.pathname);
  const workspace = WORKSPACES[id] || WORKSPACES[DEFAULT_WORKSPACE];
  const switchTo = (targetId) => {
    const target = WORKSPACES[targetId];
    if (!target) return;
    navigate(target.defaultPath);
  };
  return {
    id,
    workspace,
    switchTo,
    other: WORKSPACES[otherWorkspace(id)],
  };
}
