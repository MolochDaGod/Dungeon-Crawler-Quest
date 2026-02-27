using Mirror;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
[CreateAssetMenu(menuName = "uMMORPG Skill/AreaDamageSkill", order = 999)]
public class AreaDamageSkill : DamageSkill
{

    Vector3 aoe;

    public AreaSkillEffect areaEffect;
    public GameObject prefab;
    // OverlapSphereNonAlloc array to avoid allocations.
    // -> static so we don't create one per skill
    // -> this is worth it because skills are casted a lot!
    // -> should be big enough to work in just about all cases
    static Collider[] hitsBuffer = new Collider[10000];

    public override bool CheckSelf(Entity caster, int skillLevel)
    {
        return base.CheckSelf(caster, skillLevel);
    }

    public override bool CheckTarget(Entity caster)
    {
        // no target necessary, but still set to self so that LookAt(target)
        // doesn't cause the player to look at a target that doesn't even matter
        caster.target = caster;
        return true;
    }

    public override bool CheckDistance(Entity caster, int skillLevel, out Vector3 destination)
    {
        // can cast anywhere
        destination = caster.transform.position;
        return true;
    }

    public override void Apply(Entity caster, int skillLevel)
    {
        Player player = (Player)caster;
        // base.Apply(player, skillLevel);
        aoe = player.mouseManager.storedMousePosition;
        Quaternion transRot = Quaternion.LookRotation(aoe - player.transform.position);

        if (areaEffect != null)
        {
            GameObject go = Instantiate(areaEffect.gameObject, aoe, transRot);
            AreaSkillEffect effectComponent = go.GetComponent<AreaSkillEffect>();
            effectComponent.caster = player;
            effectComponent.damageAmount = damage.Get(skillLevel);
            effectComponent.stunChance = stunChance.Get(skillLevel);
            effectComponent.stunTime = stunTime.Get(skillLevel);
            NetworkServer.Spawn(go);
        }
        else if (prefab != null)
        {
            GameObject go = Instantiate(prefab.gameObject, aoe, transRot);
            NetworkServer.Spawn(go);
        }
    }
}
