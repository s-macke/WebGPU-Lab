@group(0) @binding(0) var<storage, read_write> v_indices_src: array<u32>; // this is used as both input and output for convenience
@group(0) @binding(1) var<storage, read_write> v_indices_dest: array<u32>; // this is used as both input and output for convenience

fn is_prime(n: u32) -> u32 {
    var i: u32 = 0u;
    if (n == 1u) {
        return 0u;
    }
    if (n == 4u) {
        return 0u;
    }
    if (n == 2u) {
        return 1u;
    }
    for (var i:u32=3; i<n/2; i++) {
        if (n % i == 0u) {
            return 0u;
        }
    }
    return 1;
}

@compute
@workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    v_indices_dest[global_id.x] = is_prime(v_indices_src[global_id.x]);
}