export type DatabaseType = "postgresql";

export type ConnectionMethod = "host" | "url";

export type SslMode =
  | "disable"
  | "allow"
  | "prefer"
  | "require"
  | "verify-ca"
  | "verify-full";

export interface DatabaseConnectionForm {
  type: DatabaseType;
  method: ConnectionMethod;

  name: string;

  host: string;
  port: string;
  database: string;
  username: string;
  password: string;

  connectionUrl: string;

  sslMode: SslMode;
}