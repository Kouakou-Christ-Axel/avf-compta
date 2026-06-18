use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Client {
    pub id: i64,
    pub nom: String,
    pub email: Option<String>,
    pub telephone: Option<String>,
    pub adresse: Option<String>,
    pub cree_le: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewClient {
    pub nom: String,
    pub email: Option<String>,
    pub telephone: Option<String>,
    pub adresse: Option<String>,
}
