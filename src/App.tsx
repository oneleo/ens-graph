import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";

import {
  id,
  solidityPacked,
  solidityPackedKeccak256,
  namehash,
  JsonRpcProvider,
  Contract,
  ContractRunner,
  getBytes,
  getBigInt,
  hexlify,
} from "ethers";

// CORS to: https://api.thegraph.com/subgraphs/name/ensdomains/ens
const SUBGRAPH_URL = `/api/subgraphs/name/ensdomains/ens`;

// Use public RPC URL
const provider = new JsonRpcProvider("https://ethereum-rpc.publicnode.com");

export class ResolverContract {
  private static abi = [
    "function addr(bytes32 node, uint coinType) public view returns(bytes memory)",
  ];

  public readonly address: string;
  private resolver: Contract;

  public static init(address: string, singer: ContractRunner) {
    const resolver = new Contract(
      address as string,
      ResolverContract.abi,
      singer
    );
    return new ResolverContract(resolver, address);
  }

  private constructor(resolver: Contract, address: string) {
    this.resolver = resolver;
    this.address = address;
  }

  public async addr(node: string, coinType: number): Promise<string> {
    return hexlify(
      await this.resolver.addr(getBytes(node), getBigInt(coinType))
    );
  }
}

function App() {
  const fetchDomain = async () => {
    const ens = "imtoken.eth";
    // const ens = "jackentropy.eth";
    // const ens = "clankers.eth";

    const subdomainsResult = await querySubdomainsFromId(getNameId(ens));
    const nameAddress: { name: string; id: string | null }[] = [];

    subdomainsResult.data.domains.forEach((domain) => {
      nameAddress.push({ name: domain.name, id: domain.resolvedAddress.id });

      domain.subdomains.forEach((subdomain) => {
        nameAddress.push({
          name: subdomain.name,
          id: subdomain.resolvedAddress ? subdomain.resolvedAddress.id : null,
        });
      });
    });

    console.log(JSON.stringify(nameAddress, null, 2));
    // Output:
    //
    // [
    //   {
    //     name: "imtoken.eth",
    //     id: "0x4e88f436422075c1417357bf957764c127b2cc93",
    //   },
    //   {
    //     name: "op.imtoken.eth",
    //     id: null,
    //   },
    // ];

    const resolverAndCoinTypesResult = await queryResolverAndCoinTypesFromId(
      getNameId(ens)
    );
    const { address: resolver, coinTypes: coinTypesString } =
      resolverAndCoinTypesResult?.data?.domains?.[0]?.resolver ?? {};

    const coinTypes = coinTypesString.map((coinType) => parseInt(coinType));
    const resolverContract = ResolverContract.init(resolver, provider);

    const recordAddress: { record: string | undefined; id: string }[] = [];
    for (const coinType of coinTypes) {
      // Get address from resolver contract
      const address = await resolverContract.addr(getNameId(ens), coinType);
      recordAddress.push({ record: lookupCoinType(coinType), id: address });
    }

    console.log(JSON.stringify(recordAddress, null, 2));
    // Output:
    //
    // [
    //   {
    //     record: "eth",
    //     id: "0x4e88f436422075c1417357bf957764c127b2cc93",
    //   },
    //   {
    //     record: "op",
    //     id: "0x4e88f436422075c1417357bf957764c127b2cc93",
    //   },
    //   {
    //     record: "arb1",
    //     id: "0x4e88f436422075c1417357bf957764c127b2cc93",
    //   },
    //   {
    //     record: "base",
    //     id: "0x4e88f436422075c1417357bf957764c127b2cc93",
    //   },
    // ];
  };

  const getNameId = (ens: string): string => {
    const name = ens.split(".");
    const length = name.length;

    const nodeEth = namehash(name[length - 1]); // eth
    const idUsername = id(name[length - 2]); // username
    return solidityPackedKeccak256(
      ["bytes"],
      [solidityPacked(["bytes32", "bytes32"], [nodeEth, idUsername])]
    );
  };

  // Resolver Address type
  type ResolverAddress = {
    id: string | null;
  };

  // Subdomain type
  type Subdomain = {
    name: string;
    resolvedAddress: ResolverAddress | null;
  };

  // Domain type
  type Domain = {
    name: string;
    resolvedAddress: ResolverAddress;
    subdomains: Subdomain[];
  };

  // The whole response type
  type Subdomains = {
    data: {
      domains: Domain[];
    };
  };

  // Playground:
  // https://cloud.hasura.io/public/graphiql?endpoint=https%3A%2F%2Fapi.thegraph.com%2Fsubgraphs%2Fname%2Fensdomains%2Fens&query=query+getSubdomainsFormId+%7B%0A++domains%28%0A++++where%3A+%7Bid%3A+%220x6996a8ad70089179bc0bf29f3519f65d65359b22bb1c324c32c60020dbffe41c%22%7D%0A++++orderBy%3A+createdAt%0A++++orderDirection%3A+desc%0A++%29+%7B%0A++++subdomains+%7B%0A++++++name%0A++++++resolvedAddress+%7B%0A++++++++id%0A++++++%7D%0A++++%7D%0A++++name%0A++++resolvedAddress+%7B%0A++++++id%0A++++%7D%0A++%7D%0A%7D%0A
  const querySubdomainsFromId = async (id: string): Promise<Subdomains> => {
    // Notice: Resolved Address is NOT the Owner (= Controller)
    // Default Owner/Controller is NameWrapper contract:
    // https://etherscan.io/address/0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401
    const query = `
query getSubdomainsFormId {
  domains(
    where: {id: "${id.toLowerCase()}"}
    orderBy: createdAt
    orderDirection: desc
  ) {
    subdomains {
      name
      resolvedAddress {
        id
      }
    }
    name
    resolvedAddress {
      id
    }
  }
}
`;
    return (await queryGraph(query, SUBGRAPH_URL)) as Subdomains;
  };

  type ResolverAndCoinTypes = {
    data: {
      domains: {
        resolver: {
          address: string;
          coinTypes: string[];
        };
      }[];
    };
  };

  // Playground:
  // https://cloud.hasura.io/public/graphiql?endpoint=https%3A%2F%2Fapi.thegraph.com%2Fsubgraphs%2Fname%2Fensdomains%2Fens&query=query+getResolverAndCoinTypesFromId+%7B%0A++domains%28%0A++++where%3A+%7Bid%3A+%220x6996a8ad70089179bc0bf29f3519f65d65359b22bb1c324c32c60020dbffe41c%22%7D%0A++++orderBy%3A+createdAt%0A++++orderDirection%3A+desc%0A++%29+%7B%0A++++resolver+%7B%0A++++++coinTypes%0A++++++address%0A++++%7D%0A++%7D%0A%7D%0A
  const queryResolverAndCoinTypesFromId = async (
    id: string
  ): Promise<ResolverAndCoinTypes> => {
    const query = `
query getResolverAndCoinTypesFromId {
  domains(
    where: {id: "${id.toLowerCase()}"}
    orderBy: createdAt
    orderDirection: desc
  ) {
    resolver {
      coinTypes
      address
    }
  }
}
`;
    return (await queryGraph(query, SUBGRAPH_URL)) as ResolverAndCoinTypes;
  };

  const lookupCoinType = (coinType: number) =>
    Object.entries(evmCoinNameToTypeMap).find(([k, v]) => v === coinType)?.[0];

  const evmCoinNameToTypeMap = {
    btc: 0,
    ltc: 2,
    doge: 3,
    rdd: 4,
    dash: 5,
    ppc: 6,
    nmc: 7,
    via: 14,
    dgb: 20,
    mona: 22,
    dcr: 42,
    xem: 43,
    aib: 55,
    sys: 57,
    eth: 60,
    etcLegacy: 61,
    icx: 74,
    xvg: 77,
    strat: 105,
    ark: 111,
    atom: 118,
    zen: 121,
    xmr: 128,
    zec: 133,
    lsk: 134,
    steem: 135,
    firo: 136,
    rbtc: 137,
    kmd: 141,
    xrp: 144,
    bch: 145,
    xlm: 148,
    btm: 153,
    btg: 156,
    nano: 165,
    rvn: 175,
    poaLegacy: 178,
    lcc: 192,
    eos: 194,
    trx: 195,
    bcn: 204,
    fio: 235,
    bsv: 236,
    nim: 242,
    ewtLegacy: 246,
    algo: 283,
    iost: 291,
    divi: 301,
    iotx: 304,
    bts: 308,
    ckb: 309,
    zil: 313,
    mrx: 326,
    luna: 330,
    dot: 354,
    vsys: 360,
    abbc: 367,
    near: 397,
    etn: 415,
    aion: 425,
    ksm: 434,
    ae: 457,
    kava: 459,
    fil: 461,
    ar: 472,
    cca: 489,
    thetaLegacy: 500,
    sol: 501,
    egld: 508,
    xhv: 535,
    flow: 539,
    iris: 566,
    lrg: 568,
    sero: 569,
    bdx: 570,
    ccxx: 571,
    srm: 573,
    vlxLegacy: 574,
    bps: 576,
    tfuel: 589,
    grin: 592,
    gnoLegacy: 700,
    bnb: 714,
    vet: 818,
    cloLegacy: 820,
    hive: 825,
    neo: 888,
    tomoLegacy: 889,
    hnt: 904,
    rune: 931,
    bcd: 999,
    ttLegacy: 1001,
    ftmLegacy: 1007,
    one: 1023,
    ont: 1024,
    nostr: 1237,
    xtz: 1729,
    ada: 1815,
    sc: 1991,
    qtum: 2301,
    gxc: 2303,
    ela: 2305,
    nas: 2718,
    hbar: 3030,
    iota: 4218,
    hns: 5353,
    stx: 5757,
    goLegacy: 6060,
    xch: 8444,
    nuls: 8964,
    avax: 9000,
    strk: 9004,
    nrgLegacy: 9797,
    ardr: 16754,
    flux: 19167,
    celoLegacy: 52752,
    wicc: 99999,
    vlx: 5655640,
    wan: 5718350,
    waves: 5741564,
    op: 2147483658,
    cro: 2147483673,
    bsc: 2147483704,
    go: 2147483708,
    etc: 2147483709,
    tomo: 2147483736,
    poa: 2147483747,
    gno: 2147483748,
    tt: 2147483756,
    matic: 2147483785,
    manta: 2147483817,
    ewt: 2147483894,
    ftm: 2147483898,
    boba: 2147483936,
    zksync: 2147483972,
    theta: 2147484009,
    clo: 2147484468,
    metis: 2147484736,
    mantle: 2147488648,
    base: 2147492101,
    nrg: 2147523445,
    arb1: 2147525809,
    celo: 2147525868,
    avaxc: 2147526762,
    linea: 2147542792,
    scr: 2148018000,
    zora: 2155261425,
  };

  const queryGraph = async (
    query: string,
    url: string
  ): Promise<any | null> => {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });

      const result = await response.json();

      if (result.errors) {
        throw new Error(`Query failure: ${result.errors}`);
      }
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`Cannot query: ${errorMessage}`);
      return null;
    }
  };

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div>
        <button onClick={fetchDomain}>fetch domain</button>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

export default App;
