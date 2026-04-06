export interface User {
    id: string;
    username: string;
    email: string;
    avatar_color: string;
  }
  
  export interface Realm {
    id: string;
    name: string;
    owner_id: string;
    invite_code: string;
    created_at: string;
  }
  
  export interface Waypoint {
    id: string;
    realm_id: string;
    created_by: string;
    name: string;
    x: number;
    y: number;
    z: number;
    dimension: 'overworld' | 'nether' | 'end';
    category: string;
    note: string | null;
    description: string | null;
    screenshot_url: string | null;
    created_at: string;
    updated_at: string;
  }
  
  export type Dimension = 'overworld' | 'nether' | 'end';