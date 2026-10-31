/** Use the existing engine; TEMP state is serialized once by the normal stateDelta. */
export function attachSqlState(host,readDatabase){
 host.sqlState={
  replace(rows){
   const db=readDatabase();
   db.run('CREATE TEMP TABLE IF NOT EXISTS __cxx_formal_state (state_path TEXT PRIMARY KEY, value_json TEXT NOT NULL)');
   db.run('BEGIN');
   try{
    db.run('DELETE FROM __cxx_formal_state');const statement=db.prepare('INSERT INTO __cxx_formal_state (state_path,value_json) VALUES (?,?)');
    try{for(const row of rows)statement.run([row.path,row.json]);}finally{statement.free();}
    db.run('COMMIT');
   }catch(error){db.run('ROLLBACK');throw error;}
  },
  read(){const result=readDatabase().exec('SELECT state_path,value_json FROM __cxx_formal_state ORDER BY state_path')[0];return result?result.values.map(([path,json])=>({path,json})):[];}
 };
}
