from dataclasses import dataclass


@dataclass(frozen=True)
class RegistryTable:
    schema: str
    name: str

    @property
    def qualified_name(self) -> str:
        return (
            f"{self.schema}.{self.name}"
        )


SYSTEMS_TABLE = RegistryTable(
    schema="ees_registry",
    name="systems",
)


DATASETS_TABLE = RegistryTable(
    schema="ees_registry",
    name="datasets",
)


RELATIONSHIPS_TABLE = RegistryTable(
    schema="ees_registry",
    name="dataset_relationships",
)