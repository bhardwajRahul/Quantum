export interface EnvVarRow{
    key: string;
    value: string;
}

export const envVarRowsFrom = (variables: Record<string, string>): EnvVarRow[] =>
    Object.entries(variables).map(([key, value]) => ({ key, value }));

export const addEnvVarRow = (rows: EnvVarRow[]): EnvVarRow[] =>
    rows.some((row) => row.key === '') ? rows : [{ key: '', value: '' }, ...rows];

export const updateEnvVarRow = (rows: EnvVarRow[], index: number, key: string, value: string): EnvVarRow[] =>
    rows.map((row, position) => (position === index ? { key, value } : row));

export const removeEnvVarRow = (rows: EnvVarRow[], index: number): EnvVarRow[] =>
    rows.filter((_, position) => position !== index);

export const envVarRowsToMap = (rows: EnvVarRow[]): Record<string, string> => {
    const variables: Record<string, string> = {};
    for(const row of rows){
        if(row.key.trim() !== '') variables[row.key] = row.value;
    }
    return variables;
};
