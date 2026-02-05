#!/usr/bin/env python
# coding: utf-8

# ## nb_dq_definition_management_functions
# 
# New notebook

# In[40]:


from pyspark.sql import functions as F
from pyspark.sql.types import StructType
import logging
from typing import Any, Optional, Dict
from datetime import datetime
from delta.tables import DeltaTable

logger = logging.getLogger(__name__)

DEFINITION_TABLE  = "dq_definitions"


# In[2]:


def get_next_id():
    max_id_row = spark.sql(f"SELECT MAX(id_definition) as max_id FROM {DEFINITION_TABLE}").first()
    return (max_id_row["max_id"] if max_id_row and max_id_row["max_id"] is not None else 1000) + 1


# In[31]:


def get_metadata(check_id, group_name, criticality_name):
    group_info = spark.sql(f"SELECT id_group, name, description FROM group WHERE name = '{group_name}'").first()
    check_info = spark.sql(f"SELECT id_check, name, description FROM check WHERE id_check = '{check_id}'").first()
    crit_info = spark.sql(f"SELECT id_criticality, priority FROM criticality WHERE name = '{criticality_name}'").first()
    
    if not group_info or not check_info or not crit_info:
        raise ValueError(f"Metadata not found for CheckID:{check_id}, Group:{group_name} or Crit:{criticality_name}")
    
    return group_info, check_info, crit_info


# In[35]:


def save_definition_entry(
    table_name: str,
    group_info: Any,
    check_info: Any,
    crit_info: Any,
    execution_layer: str,
    param_1: Optional[str] = None,
    param_2: Optional[str] = None,
    param_3: Optional[str] = None,
    param_4: Optional[str] = None,
    **extra_fields
):
    new_rule_id = get_next_id()
    table_schema = spark.table(DEFINITION_TABLE).schema
    
    new_entry = [(
        new_rule_id,
        table_name,
        1,  
        extra_fields.get('keyfields'),
        check_info['name'],
        param_1, param_2, param_3, param_4,
        extra_fields.get('comment', 'Default'),
        extra_fields.get('description', check_info['description']),
        str(check_info['id_check']),
        check_info['description'],
        crit_info['id_criticality'],
        extra_fields.get('criticality_name', 'Medium'),
        group_info['id_group'],
        group_info['name'],
        group_info['description'],
        crit_info['priority'],
        extra_fields.get('error_message', 'Default'),
        extra_fields.get('error_type', 'DQ Error'),
        extra_fields.get('stakeholder'),
        execution_layer,
        extra_fields.get('domain'),
        extra_fields.get('sub_domain'),
        False  
    )]
    
    df_new_entry = spark.createDataFrame(new_entry, table_schema)
    df_new_entry.write.format("delta").mode("append").saveAsTable(DEFINITION_TABLE)
    logger.info(f"Rule {new_rule_id} (Type {check_info['id_check']}) added for table {table_name}")


# In[9]:


def insert_null_check_definition(table_name: str, column_name: str, **kwargs):
    """ID 1: Basic NULL value check."""
    group_info, check_info, crit_info = get_metadata('1', kwargs.get('group', 'ingestion'), kwargs.get('criticality', 'Medium'))
    save_definition_entry(table_name, group_info, check_info, crit_info, kwargs.get('layer', 'Bronze'), param_1=column_name, **kwargs)


# In[10]:


def insert_value_check_definition(table_name: str, column_name: str, expected_value: Any, where_condition: str, **kwargs):
    """ID 2: Generic value check (col = val) with optional additional WHERE condition."""
    group_info, check_info, crit_info = get_metadata('2', kwargs.get('group', 'ingestion'), kwargs.get('criticality', 'Medium'))
    save_definition_entry(table_name, group_info, check_info, crit_info, kwargs.get('layer', 'Bronze'), 
                          param_1=column_name, param_2=str(expected_value), param_3=where_condition, **kwargs)


# In[11]:


def insert_row_count_range_definition(table_name: str, min_rows: int, max_rows: int, **kwargs):
    """ID 3: Static check to ensure row count is between min and max."""
    group_info, check_info, crit_info = get_metadata('3', kwargs.get('group', 'ingestion'), kwargs.get('criticality', 'Medium'))
    save_definition_entry(table_name, group_info, check_info, crit_info, kwargs.get('layer', 'Bronze'), 
                          param_1=str(min_rows), param_2=str(max_rows), **kwargs)


# In[13]:


def insert_null_with_dependency_definition(table_name: str, column_name: str, dependency_condition: str, **kwargs):
    """ID 7: NULL check triggered only when a specific dependency condition is met."""
    group_info, check_info, crit_info = get_metadata('7', kwargs.get('group', 'ingestion'), kwargs.get('criticality', 'Medium'))
    save_definition_entry(table_name, group_info, check_info, crit_info, kwargs.get('layer', 'Bronze'), 
                          param_1=column_name, param_2=dependency_condition, **kwargs)


# In[14]:


def insert_referential_integrity_definition(table_name: str, column_name: str, ref_table: str, ref_column: str, **kwargs):
    """ID 8: Referential integrity check (Left Join ensuring key exists in reference table)."""
    group_info, check_info, crit_info = get_metadata('8', kwargs.get('group', 'ingestion'), kwargs.get('criticality', 'Medium'))
    save_definition_entry(table_name, group_info, check_info, crit_info, kwargs.get('layer', 'Bronze'), 
                          param_1=column_name, param_2=ref_table, param_3=ref_column, param_4=kwargs.get('condition'), **kwargs)


# In[15]:


def insert_anomaly_check_definition(table_name: str, threshold_percent: int = 10, **kwargs):
    """ID 20: Anomaly detection based on historical row count deviation."""
    group_info, check_info, crit_info = get_metadata('20', kwargs.get('group', 'ingestion'), kwargs.get('criticality', 'Medium'))
    save_definition_entry(table_name, group_info, check_info, crit_info, kwargs.get('layer', 'Bronze'), 
                          param_1=str(threshold_percent), **kwargs)


# In[18]:


def update_rule_definition_by_id(rule_id: int, update_map) -> bool:
    """
    Updates specific fields of an existing rule using its unique ID.
    """
    if not update_map:
        return False
    
    delta_table = DeltaTable.forName(spark, DEFINITION_TABLE)
    
    update_expressions = {column: F.lit(value) for column, value in update_map.items()}
    
    delta_table.update(
        condition = F.expr(f"id_definition = {rule_id}"),
        set = update_expressions
    )
    logger.info(f"Rule ID {rule_id} successfully updated.")
    return True


# In[19]:


def delete_rule_definition_by_id(rule_id: int):
    """Deletes a specific rule definition by its unique ID."""
    spark.sql(f"DELETE FROM {DEFINITION_TABLE} WHERE id_definition = {rule_id}")
    logger.info(f"Rule ID {rule_id} has been deleted.")


# In[20]:


def delete_rules_for_table(table_name: str, check_type_id: Optional[str] = None):
    """
    Removes rules associated with a specific table. 
    Optional: Filter by check_type_id (e.g., remove only anomaly checks for a table).
    """
    sql_query = f"DELETE FROM {DEFINITION_TABLE} WHERE table_or_view = '{table_name}'"
    if check_type_id:
        sql_query += f" AND id_check = '{check_type_id}'"
    
    spark.sql(sql_query)
    logger.info(f"Rules for table '{table_name}' (CheckID: {check_type_id}) have been cleared.")


# ## Testing

# In[36]:


insert_null_check_definition(
    table_name="bronze_customers",
    column_name="customer_id",
    layer="Bronze",
    group = "hr",
    criticality="High",
    comment = "test",
    definition = "test definition",
    keyfields ="customer_id",
    stakeholder="Data Engineering Team",
    error_message="Customer ID is missing in source data"
)


# In[41]:


update_rule_definition_by_id(504,{"active": 0})


# In[43]:


delete_rule_definition_by_id(rule_id=503)


# In[46]:


delete_rules_for_table(table_name="bronze_customers")


# In[48]:


df = spark.table("dq_definitions")
display (df)

