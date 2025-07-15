import { v4 as uuidv4 } from 'uuid';

export interface CRDTNode {
  id: string;
  timestamp: number;
  value: any;
  metadata?: Record<string, any> | undefined;
}

export interface CRDTState {
  nodes: Map<string, CRDTNode>;
  lastUpdate: number;
  version: number;
}

export interface CRDTOperation {
  id: string;
  type: 'add' | 'update' | 'delete' | 'merge';
  nodeId?: string;
  value?: any;
  timestamp: number;
  userId: string;
  metadata?: Record<string, any>;
}

export interface CRDTMergeResult {
  success: boolean;
  conflicts: CRDTConflict[];
  mergedState: CRDTState;
}

export interface CRDTConflict {
  type: 'concurrent_update' | 'deletion_conflict' | 'value_conflict';
  nodeId: string;
  localValue: any;
  remoteValue: any;
  resolution: 'local_wins' | 'remote_wins' | 'manual_resolution_required';
  message: string;
}

/**
 * CRDT (Conflict-free Replicated Data Type) for real-time state synchronization
 */
export class CRDT {
  private state: CRDTState;
  private nodeId: string;
  private conflictResolvers: Map<string, (local: any, remote: any) => any> = new Map();

  constructor(initialState?: Partial<CRDTState>) {
    this.nodeId = uuidv4();
    this.state = {
      nodes: new Map(),
      lastUpdate: Date.now(),
      version: 1,
      ...initialState,
    };
  }

  /**
   * Add a new node to the CRDT
   */
  addNode(value: any, metadata?: Record<string, any>): CRDTNode {
    const node: CRDTNode = {
      id: uuidv4(),
      timestamp: Date.now(),
      value,
      metadata,
    };

    this.state.nodes.set(node.id, node);
    this.state.lastUpdate = Date.now();
    this.state.version++;

    return node;
  }

  /**
   * Update an existing node
   */
  updateNode(nodeId: string, value: any, metadata?: Record<string, any>): boolean {
    const node = this.state.nodes.get(nodeId);
    if (!node) {
      return false;
    }

    const updatedNode: CRDTNode = {
      ...node,
      value,
      timestamp: Date.now(),
      metadata: { ...node.metadata, ...metadata },
    };

    this.state.nodes.set(nodeId, updatedNode);
    this.state.lastUpdate = Date.now();
    this.state.version++;

    return true;
  }

  /**
   * Delete a node (tombstone approach)
   */
  deleteNode(nodeId: string): boolean {
    const node = this.state.nodes.get(nodeId);
    if (!node) {
      return false;
    }

    const deletedNode: CRDTNode = {
      ...node,
      value: null, // Tombstone
      timestamp: Date.now(),
      metadata: { ...node.metadata, deleted: true },
    };

    this.state.nodes.set(nodeId, deletedNode);
    this.state.lastUpdate = Date.now();
    this.state.version++;

    return true;
  }

  /**
   * Get a node by ID
   */
  getNode(nodeId: string): CRDTNode | undefined {
    return this.state.nodes.get(nodeId);
  }

  /**
   * Get all active nodes (non-deleted)
   */
  getActiveNodes(): CRDTNode[] {
    return Array.from(this.state.nodes.values()).filter(node => 
      node.value !== null && !node.metadata?.['deleted']
    );
  }

  /**
   * Get all nodes including deleted ones
   */
  getAllNodes(): CRDTNode[] {
    return Array.from(this.state.nodes.values());
  }

  /**
   * Get current state
   */
  getState(): CRDTState {
    return { ...this.state };
  }

  /**
   * Merge with another CRDT state
   */
  merge(remoteState: CRDTState): CRDTMergeResult {
    const conflicts: CRDTConflict[] = [];
    const mergedNodes = new Map(this.state.nodes);

    // Process remote nodes
    for (const [nodeId, remoteNode] of remoteState.nodes) {
      const localNode = mergedNodes.get(nodeId);

      if (!localNode) {
        // New node from remote
        mergedNodes.set(nodeId, remoteNode);
      } else {
        // Conflict resolution
        const conflict = this.resolveConflict(localNode, remoteNode);
        if (conflict) {
          conflicts.push(conflict);
          
          // Apply resolution
          switch (conflict.resolution) {
            case 'local_wins':
              // Keep local node
              break;
            case 'remote_wins':
              mergedNodes.set(nodeId, remoteNode);
              break;
            case 'manual_resolution_required':
              // Keep the most recent version
              if (remoteNode.timestamp > localNode.timestamp) {
                mergedNodes.set(nodeId, remoteNode);
              }
              break;
          }
        } else {
          // No conflict, keep the most recent
          if (remoteNode.timestamp > localNode.timestamp) {
            mergedNodes.set(nodeId, remoteNode);
          }
        }
      }
    }

    const mergedState: CRDTState = {
      nodes: mergedNodes,
      lastUpdate: Math.max(this.state.lastUpdate, remoteState.lastUpdate),
      version: Math.max(this.state.version, remoteState.version) + 1,
    };

    this.state = mergedState;

    return {
      success: conflicts.length === 0,
      conflicts,
      mergedState,
    };
  }

  /**
   * Resolve conflicts between local and remote nodes
   */
  private resolveConflict(local: CRDTNode, remote: CRDTNode): CRDTConflict | null {
    // If timestamps are exactly the same, it's a concurrent update
    if (local.timestamp === remote.timestamp) {
      return {
        type: 'concurrent_update',
        nodeId: local.id,
        localValue: local.value,
        remoteValue: remote.value,
        resolution: 'manual_resolution_required',
        message: 'Concurrent updates detected',
      };
    }

    // If one is deleted and the other isn't
    if ((local.value === null) !== (remote.value === null)) {
      return {
        type: 'deletion_conflict',
        nodeId: local.id,
        localValue: local.value,
        remoteValue: remote.value,
        resolution: 'manual_resolution_required',
        message: 'Deletion conflict detected',
      };
    }

    // If values are different and timestamps are close (within 1 second)
    if (
      local.value !== remote.value &&
      Math.abs(local.timestamp - remote.timestamp) < 1000
    ) {
      return {
        type: 'value_conflict',
        nodeId: local.id,
        localValue: local.value,
        remoteValue: remote.value,
        resolution: 'manual_resolution_required',
        message: 'Value conflict detected',
      };
    }

    return null;
  }

  /**
   * Register a custom conflict resolver for specific node types
   */
  registerConflictResolver(
    nodeType: string,
    resolver: (local: any, remote: any) => any
  ): void {
    this.conflictResolvers.set(nodeType, resolver);
  }

  /**
   * Get changes since a specific timestamp
   */
  getChangesSince(timestamp: number): CRDTNode[] {
    return Array.from(this.state.nodes.values()).filter(
      node => node.timestamp > timestamp
    );
  }

  /**
   * Get changes since a specific version
   */
  getChangesSinceVersion(version: number): CRDTNode[] {
    // This is a simplified implementation
    // In a real system, you'd track version numbers per node
    return this.getAllNodes();
  }

  /**
   * Create a diff between two states
   */
  static diff(localState: CRDTState, remoteState: CRDTState): {
    added: CRDTNode[];
    updated: CRDTNode[];
    deleted: CRDTNode[];
  } {
    const added: CRDTNode[] = [];
    const updated: CRDTNode[] = [];
    const deleted: CRDTNode[] = [];

    // Find added and updated nodes
    for (const [nodeId, remoteNode] of remoteState.nodes) {
      const localNode = localState.nodes.get(nodeId);
      
      if (!localNode) {
        added.push(remoteNode);
      } else if (remoteNode.timestamp > localNode.timestamp) {
        updated.push(remoteNode);
      }
    }

    // Find deleted nodes (nodes that exist locally but not remotely)
    for (const [nodeId, localNode] of localState.nodes) {
      if (!remoteState.nodes.has(nodeId)) {
        deleted.push(localNode);
      }
    }

    return { added, updated, deleted };
  }

  /**
   * Serialize state for transmission
   */
  serialize(): string {
    return JSON.stringify({
      nodes: Array.from(this.state.nodes.entries()),
      lastUpdate: this.state.lastUpdate,
      version: this.state.version,
    });
  }

  /**
   * Deserialize state from transmission
   */
  static deserialize(data: string): CRDTState {
    const parsed = JSON.parse(data);
    return {
      nodes: new Map(parsed.nodes),
      lastUpdate: parsed.lastUpdate,
      version: parsed.version,
    };
  }
}

/**
 * Specialized CRDT for game state
 */
export class GameStateCRDT extends CRDT {
  constructor() {
    super();
    
    // Register game-specific conflict resolvers
    this.registerConflictResolver('player_score', (local, remote) => {
      // For scores, take the higher value
      return Math.max(local, remote);
    });

    this.registerConflictResolver('player_status', (local: string, remote: string) => {
      // For player status, prioritize 'playing' over 'ready' over 'joined'
      const priority: Record<string, number> = { playing: 3, ready: 2, joined: 1, left: 0, disconnected: 0 };
      return priority[local] >= priority[remote] ? local : remote;
    });

    this.registerConflictResolver('game_status', (local: string, remote: string) => {
      // For game status, prioritize 'finished' over 'playing' over 'waiting'
      const priority: Record<string, number> = { finished: 3, playing: 2, waiting: 1, cancelled: 0 };
      return priority[local] >= priority[remote] ? local : remote;
    });
  }

  /**
   * Add a player to the game
   */
  addPlayer(playerId: string, playerData: any): CRDTNode {
    return this.addNode(playerData, {
      type: 'player',
      playerId,
      operation: 'add',
    });
  }

  /**
   * Update player score
   */
  updatePlayerScore(playerId: string, score: number): boolean {
    const nodes = this.getActiveNodes();
    const playerNode = nodes.find(node => 
      node.metadata?.type === 'player' && 
      node.metadata?.playerId === playerId
    );

    if (playerNode) {
      return this.updateNode(playerNode.id, { ...playerNode.value, score }, {
        type: 'player_score',
        playerId,
        operation: 'update_score',
      });
    }

    return false;
  }

  /**
   * Update player status
   */
  updatePlayerStatus(playerId: string, status: string): boolean {
    const nodes = this.getActiveNodes();
    const playerNode = nodes.find(node => 
      node.metadata?.type === 'player' && 
      node.metadata?.playerId === playerId
    );

    if (playerNode) {
      return this.updateNode(playerNode.id, { ...playerNode.value, status }, {
        type: 'player_status',
        playerId,
        operation: 'update_status',
      });
    }

    return false;
  }

  /**
   * Remove player from game
   */
  removePlayer(playerId: string): boolean {
    const nodes = this.getActiveNodes();
    const playerNode = nodes.find(node => 
      node.metadata?.type === 'player' && 
      node.metadata?.playerId === playerId
    );

    if (playerNode) {
      return this.deleteNode(playerNode.id);
    }

    return false;
  }

  /**
   * Get all players in the game
   */
  getPlayers(): any[] {
    return this.getActiveNodes()
      .filter(node => node.metadata?.type === 'player')
      .map(node => ({ ...node.value, id: node.metadata?.playerId }));
  }

  /**
   * Get game state summary
   */
  getGameState(): {
    players: any[];
    lastUpdate: number;
    version: number;
  } {
    return {
      players: this.getPlayers(),
      lastUpdate: this.getState().lastUpdate,
      version: this.getState().version,
    };
  }
} 