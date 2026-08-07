from typing import Literal, Optional

from pydantic import BaseModel, Field


# Connection Test

class ConnectionTestRequest(BaseModel):
    method: Literal["host", "url"]

    name: str = Field(min_length=1)

    host: Optional[str] = None
    port: Optional[int] = None
    database: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None

    connection_url: Optional[str] = None

    ssl_mode: Literal[
        "disable",
        "allow",
        "prefer",
        "require",
        "verify-ca",
        "verify-full",
    ] = "prefer"


class ConnectionTestResponse(BaseModel):
    success: bool
    message: str
    server_version: Optional[str] = None
    database: Optional[str] = None
    
#  Metadata     
    
class ObjectMetadataRequest(BaseModel):
    connection: ConnectionTestRequest
    schema_name: str
    object_name: str


class ColumnMetadata(BaseModel):
    name: str
    data_type: str
    nullable: bool
    default: Optional[str] = None
    position: int
    primary_key: bool


class IndexMetadata(BaseModel):
    name: str
    definition: str


class ObjectMetadataResponse(BaseModel):
    success: bool
    message: Optional[str] = None

    schema: Optional[str] = None
    name: Optional[str] = None
    object_type: Optional[str] = None

    columns: list[ColumnMetadata] = []
    indexes: list[IndexMetadata] = []    