declare global {
  interface Window {
    __eveDomSafetyInstalled?: boolean;
    __eveDomSafetyStats?: {
      removeChildSkipped: number;
      insertBeforeFallback: number;
    };
  }
}

function isNotFoundDomError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: string }).name === "NotFoundError"
  );
}

/**
 * Guard against DOM mutation races where runtime/browser internals detach nodes
 * between reconciliation steps. This prevents hard-crashes from NotFoundError.
 */
export function installDomSafetyGuards() {
  if (typeof window === "undefined" || window.__eveDomSafetyInstalled) return;
  window.__eveDomSafetyInstalled = true;
  window.__eveDomSafetyStats = {
    removeChildSkipped: 0,
    insertBeforeFallback: 0,
  };

  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (!child || child.parentNode !== this) {
      window.__eveDomSafetyStats!.removeChildSkipped += 1;
      return child;
    }
    try {
      return originalRemoveChild.call(this, child) as T;
    } catch (error) {
      if (isNotFoundDomError(error)) {
        window.__eveDomSafetyStats!.removeChildSkipped += 1;
        return child;
      }
      throw error;
    }
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(
    newNode: T,
    referenceNode: Node | null,
  ): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      window.__eveDomSafetyStats!.insertBeforeFallback += 1;
      return this.appendChild(newNode) as T;
    }
    try {
      return originalInsertBefore.call(this, newNode, referenceNode) as T;
    } catch (error) {
      if (isNotFoundDomError(error)) {
        window.__eveDomSafetyStats!.insertBeforeFallback += 1;
        return this.appendChild(newNode) as T;
      }
      throw error;
    }
  };
}

