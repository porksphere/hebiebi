/**
 * Marks the development-client build in its display name, without changing its identity.
 *
 * Activated by HEBIEBI_DEVCLIENT=1 at prebuild time (build-ios-devclient.yml sets it). For every
 * other build this plugin does nothing.
 *
 * The bundle id is deliberately unchanged, so the dev client installs into the same slot as the
 * regular app and shares its data (your signed-in token included). That also keeps it from using
 * a second of the three app slots a free Apple ID gets in AltStore/SideStore. The cost: installing
 * the dev client replaces the regular app, and reinstalling the regular app replaces it back.
 *
 * It also opts the dev client out of App Transport Security, because it loads JS over plain HTTP
 * from Metro. Expo's default (NSAllowsLocalNetworking) covers LAN addresses, but not a Metro
 * reached over a VPN/overlay network such as Tailscale (100.64.0.0/10). NSAllowsLocalNetworking
 * must be ABSENT: on iOS 10+ its presence makes iOS ignore NSAllowsArbitraryLoads.
 */
module.exports = function withDevClientVariant(config) {
  if (process.env.HEBIEBI_DEVCLIENT !== '1') return config;
  return {
    ...config,
    name: `${config.name} (dev)`,
    ios: {
      ...config.ios,
      infoPlist: {
        ...config.ios?.infoPlist,
        NSAppTransportSecurity: { NSAllowsArbitraryLoads: true },
      },
    },
  };
};
