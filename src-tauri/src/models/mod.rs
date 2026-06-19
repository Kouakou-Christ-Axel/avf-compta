pub mod client;
pub mod note;
pub mod paiement;
pub mod parametres;
pub mod prestation;
pub mod recu;
pub mod stats;

pub use client::{Client, NewClient};
pub use note::{NewNote, NoteDeFrais, NoteDetail, NoteLigne};
pub use paiement::{NewPaiement, Paiement, SoldeNote};
pub use parametres::Parametres;
pub use prestation::{NewPrestation, Prestation};
pub use recu::{Recu, RecuDetail};
pub use stats::ResumeStats;
