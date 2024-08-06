use solver::how_many_traces::count_candidates_num_for_each_indexes;
use std::env;

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() != 2 {
        usage();
        return;
    }
    match args[1].parse::<u32>() {
        Ok(max_trace_num) => {
            let num_array = count_candidates_num_for_each_indexes(max_trace_num);
            println!("{:?},", &num_array[0..8]);
            println!("{:?},", &num_array[8..16]);
            println!("{:?},", &num_array[16..24]);
            println!("{:?},", &num_array[24..32]);
            println!("{:?},", &num_array[32..40]);
            println!("{:?}", &num_array[40..48]);
            let candidates_num: u64 = num_array.iter().sum();
            println!("sum: {}", candidates_num);
        }
        Err(_e) => {
            usage();
        }
    }
}

fn usage() {
    println!("cargo run --release <max_trace_num>");
}
