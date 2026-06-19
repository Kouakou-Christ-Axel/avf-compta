use crate::error::AppResult;
use crate::models::Parametres;
use rusqlite::Connection;

/// Lit le profil du cabinet (ligne unique id = 1).
pub fn get(conn: &Connection) -> AppResult<Parametres> {
    Ok(conn.query_row(
        "SELECT cabinet_nom, email, telephone, coordonnees_paiement, logo
         FROM parametres WHERE id = 1",
        [],
        |row| {
            Ok(Parametres {
                cabinet_nom: row.get(0)?,
                email: row.get(1)?,
                telephone: row.get(2)?,
                coordonnees_paiement: row.get(3)?,
                logo: row.get(4)?,
            })
        },
    )?)
}

/// Enregistre (remplace) le profil du cabinet.
pub fn save(conn: &Connection, p: &Parametres) -> AppResult<()> {
    conn.execute(
        "UPDATE parametres
         SET cabinet_nom = ?1, email = ?2, telephone = ?3,
             coordonnees_paiement = ?4, logo = ?5
         WHERE id = 1",
        rusqlite::params![
            p.cabinet_nom,
            p.email,
            p.telephone,
            p.coordonnees_paiement,
            p.logo
        ],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;

    #[test]
    fn defaults_to_empty_row() {
        let conn = open_in_memory().unwrap();
        assert_eq!(get(&conn).unwrap(), Parametres::default());
    }

    #[test]
    fn save_then_get_round_trips() {
        let conn = open_in_memory().unwrap();
        let p = Parametres {
            cabinet_nom: Some("Cabinet AVF".into()),
            email: Some("avf@exemple.ci".into()),
            telephone: Some("0102030405".into()),
            coordonnees_paiement: Some("Wave: +225 0700000000".into()),
            logo: Some("data:image/png;base64,AAAA".into()),
        };
        save(&conn, &p).unwrap();
        assert_eq!(get(&conn).unwrap(), p);
    }
}
