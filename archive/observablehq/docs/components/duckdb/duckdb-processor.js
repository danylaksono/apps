export class DuckDBProcessor {
    constructor(con) {
        this.con = con;
        this.data = data;
    }

    async process(query) {
        return this.con.query(query);
    }

    filterData(data, filter) {
        return data.filter(filter);
    }


}



// import { DuckDBClient } from "../duckdb.js";


// export class DuckDBProcessor {
//     constructor() {
//         this.client = new DuckDBClient();
//     }

//     async process(query) {
//         return this.client.run(query);
//     }


// }